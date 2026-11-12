"""Tests for local model download filters."""
import fnmatch
import unittest

from scripts.download_models import CLIP_PATTERNS, IP_PATTERNS


class ModelDownloadPatterns(unittest.TestCase):
    def test_clip_filter_includes_pytorch_weights(self):
        self.assertTrue(any(fnmatch.fnmatchcase("pytorch_model.bin", pattern) for pattern in CLIP_PATTERNS))

    def test_ip_adapter_filter_skips_duplicate_image_encoder_weights(self):
        self.assertTrue(any(fnmatch.fnmatchcase("sdxl_models/image_encoder/model.safetensors", pattern) for pattern in IP_PATTERNS))
        self.assertFalse(any(fnmatch.fnmatchcase("sdxl_models/image_encoder/pytorch_model.bin", pattern) for pattern in IP_PATTERNS))


if __name__ == "__main__":
    unittest.main()
