// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @dev Mock ERC20 token for testing purposes
 * Allows minting and burning for easy testing of the DEX
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 tokenDecimals
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = tokenDecimals;
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint tokens to any address - useful for testing
     * @param to Address to mint tokens to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from any address - useful for testing
     * @param from Address to burn tokens from  
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    /**
     * @dev Mint tokens to caller - for easy testing without owner
     * @param amount Amount to mint to caller
     */
    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}