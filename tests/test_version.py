import semver
from meridian._version import VERSION, __version__


def test_version_is_semver():
    assert isinstance(VERSION, semver.Version)


def test_version_string():
    assert __version__ == str(VERSION)
    semver.Version.parse(__version__)  # raises if invalid
