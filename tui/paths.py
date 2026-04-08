"""Filesystem paths for the TUI."""

import os

from platformdirs import user_data_dir

DATA_DIR = os.environ.get("ATBBS_DATA_DIR", user_data_dir("atbbs"))
