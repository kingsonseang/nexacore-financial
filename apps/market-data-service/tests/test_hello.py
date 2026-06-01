"""Hello unit test module."""

from apps/market_data_service.hello import hello


def test_hello():
    """Test the hello function."""
    assert hello() == "Hello apps/market-data-service"
