// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

/**
 * @title SimplePriceHelper
 * @dev Simplified price helper for testing without Chainlink dependency
 * In production, this should be replaced with actual Chainlink oracle integration
 */
contract SimplePriceHelper {
    
    // Mock prices for testing (price * 10^8 for 8 decimal places)
    mapping(address => uint256) public mockPrices;
    mapping(address => uint8) public mockDecimals;
    
    // Events
    event MockPriceSet(address indexed token, uint256 price, uint8 decimal);
    
    function registerOracle(address _registry) internal {
        // For testing, we don't actually register with Chainlink
        // Set some default mock prices
        _setDefaultMockPrices();
    }
    
    function _setDefaultMockPrices() internal {
        // Set default mock prices for common tokens (8 decimals like Chainlink)
        
        // ETH = $2000
        mockPrices[0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE] = 2000 * 10**8;
        mockDecimals[0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE] = 8;
        
        // These will be overridden when actual token addresses are set
    }
    
    /**
     * @dev Get price from mock oracle
     * @param base Token address to get price for
     * @return price Token price in USD
     * @return decimal Number of decimal places
     */
    function getPrice(address base) public view returns (uint256, uint8) {
        uint256 price = mockPrices[base];
        uint8 decimal = mockDecimals[base];
        
        if(price == 0) {
            // Default price if not set: $1 with 8 decimals
            price = 1 * 10**8;
            decimal = 8;
        }
        
        require(price > 0, "Invalid price");
        return (price, decimal);
    }
    
    /**
     * @dev Set mock price for a token (only for testing)
     * @param token Token address
     * @param price Price in USD (with specified decimals)
     * @param decimal Number of decimal places
     */
    function setMockPrice(address token, uint256 price, uint8 decimal) external {
        require(price > 0, "Price must be positive");
        require(decimal <= 18, "Too many decimals");
        
        mockPrices[token] = price;
        mockDecimals[token] = decimal;
        
        emit MockPriceSet(token, price, decimal);
    }
    
    /**
     * @dev Get mock price (external function for testing)
     * @param token Token address
     * @return price Current mock price
     * @return decimal Number of decimal places
     */
    function getMockPrice(address token) external view returns (uint256 price, uint8 decimal) {
        return getPrice(token);
    }
}