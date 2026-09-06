"""Temporary local HTTP server to catch OAuth callbacks."""

import asyncio
from dataclasses import dataclass, field

from aiohttp import web


@dataclass
class CallbackListener:
    """A bound loopback callback listener for one OAuth state value."""

    runner: web.AppRunner
    expected_state: str
    port: int
    result: dict[str, str] = field(default_factory=dict)
    event: asyncio.Event = field(default_factory=asyncio.Event)

    async def close(self) -> None:
        await self.runner.cleanup()

    async def wait(self, timeout: float = 90.0) -> dict[str, str]:
        try:
            await asyncio.wait_for(self.event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            raise RuntimeError(
                f"Timed out waiting for OAuth callback after {int(timeout)}s."
            ) from None
        finally:
            await self.close()
        return self.result


async def start_callback_listener(
    expected_state: str, port: int = 23847
) -> CallbackListener:
    """Bind the loopback callback listener before browser navigation."""
    result: dict[str, str] = {}
    event = asyncio.Event()

    async def handle_callback(request: web.Request) -> web.Response:
        if request.query.get("state") != expected_state:
            return web.Response(text="Invalid OAuth state.", status=400)
        result.update(
            code=request.query.get("code", ""),
            state=request.query.get("state", ""),
            iss=request.query.get("iss", ""),
        )
        event.set()
        return web.Response(
            text="<html><body><p>Login complete. You can close this tab.</p></body></html>",
            content_type="text/html",
        )

    app = web.Application()
    app.router.add_get("/oauth/callback", handle_callback)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", port)
    try:
        await site.start()
    except OSError as e:
        await runner.cleanup()
        raise RuntimeError(
            f"Could not bind OAuth callback server on 127.0.0.1:{port} "
            f"({e}). Is another atbbs login in progress?"
        ) from e

    bound_port = site._server.sockets[0].getsockname()[1]
    listener = CallbackListener(
        runner=runner,
        expected_state=expected_state,
        port=bound_port,
        result=result,
        event=event,
    )
    return listener


async def wait_for_callback(
    expected_state: str, port: int = 23847, timeout: float = 90.0
) -> dict[str, str]:
    """Bind and wait for a callback with the expected OAuth state."""
    listener = await start_callback_listener(expected_state, port)
    return await listener.wait(timeout)
