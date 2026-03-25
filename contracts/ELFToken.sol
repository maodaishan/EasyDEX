// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ELFToken
 * @dev ELF (EasyDEX Liquidity Fund) token represents liquidity provider's share in the protocol
 * It's minted when users add liquidity and burned when they remove it
 * The token value is backed by the total value locked (TVL) in all pools
 */
contract ELFToken is ERC20, ERC20Burnable, Ownable {
    
    // Only the PoolManager can mint new tokens
    address public poolManager;
    
    // Events
    event PoolManagerSet(address indexed oldManager, address indexed newManager);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager can call this function");
        _;
    }
    
    constructor() ERC20("EasyDEX Liquidity Fund", "ELF") Ownable(msg.sender) {
        // Initial supply is 0 - tokens are minted as liquidity is added
    }
    
    /**
     * @dev Set the PoolManager address - only callable by owner
     * @param _poolManager Address of the PoolManager contract
     */
    function setPoolManager(address _poolManager) external onlyOwner {
        require(_poolManager != address(0), "Invalid PoolManager address");
        address oldManager = poolManager;
        poolManager = _poolManager;
        emit PoolManagerSet(oldManager, _poolManager);
    }
    
    /**
     * @dev Mint tokens to a user - only callable by PoolManager
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyPoolManager {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Cannot mint zero tokens");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens from a user - only callable by PoolManager
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        require(
            msg.sender == poolManager || msg.sender == from,
            "Only PoolManager or token owner can burn"
        );
        
        if(msg.sender == poolManager) {
            // PoolManager can burn directly without allowance
            _burn(from, amount);
        } else {
            // User burning their own tokens - use standard burnFrom
            super.burnFrom(from, amount);
        }
        
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Override burn function to emit event
     */
    function burn(uint256 amount) public override {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Get the current price of ELF token in USD (requires PoolManager to be set)
     * @return price Price in USD with specified decimal places
     * @return decimal Number of decimal places for the price
     */
    function getCurrentPrice() external view returns (uint256 price, uint8 decimal) {
        require(poolManager != address(0), "PoolManager not set");
        
        // Call PoolManager to get current ELF price
        (bool success, bytes memory data) = poolManager.staticcall(
            abi.encodeWithSignature("getELFPrice()")
        );
        
        require(success, "Failed to get ELF price");
        (price, decimal) = abi.decode(data, (uint256, uint8));
    }
    
    /**
     * @dev Get the total value locked backing this token
     * @return tvl Total value locked in USD
     */
    function getTotalValueLocked() external view returns (uint256 tvl) {
        require(poolManager != address(0), "PoolManager not set");
        
        // Call PoolManager to get TVL
        (bool success, bytes memory data) = poolManager.staticcall(
            abi.encodeWithSignature("getTVL()")
        );
        
        require(success, "Failed to get TVL");
        tvl = abi.decode(data, (uint256));
    }
    
    /**
     * @dev Calculate the USD value of a given amount of ELF tokens
     * @param amount Amount of ELF tokens
     * @return value USD value of the tokens
     * @return decimal Decimal places for the value
     */
    function calculateValue(uint256 amount) external view returns (uint256 value, uint8 decimal) {
        (uint256 price, uint8 priceDecimal) = this.getCurrentPrice();
        value = amount * price;
        decimal = priceDecimal + decimals();
    }
    
    /**
     * @dev Emergency function to pause transfers (owner only)
     */
    function pause() external onlyOwner {
        // This would require adding Pausable functionality if needed
        // For now, we can transfer ownership to address(0) to effectively pause
        revert("Pause functionality not implemented");
    }
}