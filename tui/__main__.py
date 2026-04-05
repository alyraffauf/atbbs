import rich_click as click

from importlib.metadata import version as pkg_version
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
    """Launch the TUI. Optionally dial a BBS directly."""
    from tui.app import AtbbsApp

    app = AtbbsApp(dial=handle)
    app.run()


@cli.command()
@click.option("--host", default="0.0.0.0", show_default=True, help="Host to bind to.")
@click.option("--port", "-p", default=8000, show_default=True, type=int, help="Port to bind to.")
@click.option("--public-url", default=None, help="Public URL for OAuth callbacks. [default: http://{host}:{port}]")
@click.option("--data-dir", default=DEFAULT_DATA_DIR, show_default=True, help="Directory for secrets and database.")
def serve(host: str, port: int, public_url: str | None, data_dir: str):
    """Start the web server."""
    from web.app import create_app

    if not public_url:
        public_url = f"http://{host}:{port}"

    app = create_app(data_dir=data_dir, public_url=public_url)
    app.run(host=host, port=port)


def main():
    cli()


if __name__ == "__main__":
    main()
