import os
import unittest
from unittest.mock import patch

import main


class BrowserOptionTests(unittest.TestCase):
    def test_default_does_not_open_browser(self):
        args = main.parse_args([])
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(main.should_open_browser(args))

    def test_no_browser_argument_disables_auto_open(self):
        args = main.parse_args(['--no-browser'])
        self.assertFalse(main.should_open_browser(args))

    def test_open_browser_argument_enables_auto_open(self):
        args = main.parse_args(['--open-browser'])
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(main.should_open_browser(args))

    def test_open_browser_argument_overrides_env(self):
        args = main.parse_args(['--open-browser'])
        with patch.dict(os.environ, {'MARKINOTE_OPEN_BROWSER': '0'}, clear=False):
            self.assertTrue(main.should_open_browser(args))

    def test_env_can_enable_browser_when_argument_omitted(self):
        args = main.parse_args([])
        with patch.dict(os.environ, {'MARKINOTE_OPEN_BROWSER': '1'}, clear=False):
            self.assertTrue(main.should_open_browser(args))


if __name__ == '__main__':
    unittest.main()
