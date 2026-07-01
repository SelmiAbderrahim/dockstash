import sys
from unittest.mock import patch

from prompt_executor import install_crash_handlers


class TestInstallCrashHandlers:
    def test_installs_excepthook(self):
        original = sys.excepthook
        install_crash_handlers()
        assert sys.excepthook is not original
        sys.excepthook = original

    def test_excepthook_logs(self, runtime_files):
        original = sys.excepthook
        install_crash_handlers()
        try:
            sys.excepthook(ValueError, ValueError("test crash"), None)
            content = runtime_files["log"].read_text()
            assert "UNHANDLED EXCEPTION" in content
            assert "ValueError" in content
        finally:
            sys.excepthook = original

    def test_atexit_registered(self):
        import atexit

        with patch.object(atexit, "register") as mock:
            install_crash_handlers()
        mock.assert_called_once()
