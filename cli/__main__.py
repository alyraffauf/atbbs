from importlib.metadata import version as pkg_version

import rich_click as click
from platformdirs import user_data_dir

DEFAULT_DATA_DIR = user_data_dir("atbbs")


@click.group(invoke_without_command=True)
@click.version_option(version=pkg_version("atbbs"), prog_name="atbbs")
@click.pass_context
def cli(ctx: click.Context):
    """Decentralized bulletin boards on atproto."""
    if ctx.invoked_subcommand is None:
        ctx.invoke(dial)


@cli.command()
@click.argument("handle", required=False)
def dial(handle: str | None):
    """Dial a BBS from the terminal."""
    from tui.app import AtbbsApp

    app = AtbbsApp(dial=handle)
    app.run()


@cli.command()
@click.option("--host", default="127.0.0.1", show_default=True, help="Host to bind to.")
@click.option(
    "--port", "-p", default=8000, show_default=True, type=int, help="Port to bind to."
)
@click.option(
    "--workers",
    "-w",
    default=1,
    show_default=True,
    type=int,
    help="Number of worker processes.",
)
@click.option(
    "--public-url",
    default=None,
    help="Public URL for OAuth callbacks. [default: http://{host}:{port}]",
)
@click.option(
    "--data-dir",
    default=DEFAULT_DATA_DIR,
    show_default=True,
    help="Directory for secrets and database.",
)
def serve(host: str, port: int, workers: int, public_url: str | None, data_dir: str):
    """Start the web server."""
    import os
    import subprocess
    import sys

    if not public_url:
        public_url = f"http://{host}:{port}"

    os.environ.setdefault("ATBBS_DATA_DIR", data_dir)
    os.environ.setdefault("PUBLIC_URL", public_url)

    # Ensure data dir and secrets exist before spawning workers
    os.makedirs(data_dir, exist_ok=True)
    from core.auth.config import load_secrets

    load_secrets(data_dir)

    cmd = [
        sys.executable,
        "-m",
        "hypercorn",
        "web.app:create_app()",
        "--bind",
        f"{host}:{port}",
        "--workers",
        str(workers),
    ]
    raise SystemExit(subprocess.run(cmd).returncode)


def main():
    cli()


if __name__ == "__main__":
    main()
