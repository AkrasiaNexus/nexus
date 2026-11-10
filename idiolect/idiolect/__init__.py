"""Idiolect: a portable profile of how one person writes, for any AI model."""
from .intents import Intent, classify
from .normalize import Normalized, normalize, tokenize
from .profile import Profile, load, parse

__all__ = ["Intent", "Normalized", "Profile", "classify", "load", "normalize", "parse", "tokenize"]
__version__ = "0.1.0"
