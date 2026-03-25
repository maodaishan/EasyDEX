// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEasyToken.sol";
import "./interfaces/IPoolManager.sol";
import "./utils/MathUtils.sol";

/**
 * @title EasyToken
 * @dev EASY governance token for the EasyDEX protocol
 * Users can earn EASY tokens by providing liquidity or trading
 * EASY holders can vote on protocol parameters
 */
contract EasyToken is ERC20, Ownable, IEasyToken {
    
    /// @notice Settings for reward calculation based on TVL stages
    /// 3 stages: each stage has 4 bytes for edge(uint32) and 1 byte for the target ratio
    /// Format: from right to left, is higher to lower, begin from 0
    uint128 constant GATE_SETTINGS_MASK = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    uint64 constant SINGLE_SETTING_MASK = 0xFFFFFFFFFF;
    uint8 constant SHIFT = 40;
    uint8 constant SETTING_NUMBER = 3;

    uint256 public settings;
    address public poolManager;
    
    // Mapping to track total rewards earned by users
    mapping(address => uint256) public totalRewardsEarned;
    
    // Events
    event PoolManagerSet(address indexed oldManager, address indexed newManager);
    // Event defined in interface - don't redefine
    event RewardMinted(address indexed user, uint256 amount, string reason);
    
    modifier onlyPoolManager() {
        require(msg.sender == poolManager, "Only PoolManager can call this function");
        _;
    }
    
    constructor(uint256 defaultSettings) ERC20("EasyDEX Token", "EASY") Ownable(msg.sender) {
        settings = defaultSettings;
        
        // Mint initial supply to deployer (10M tokens for team allocation)
        _mint(msg.sender, 10_000_000 * 10 ** decimals());
    }
    
    /**
     * @dev Set the PoolManager address - only callable by owner
     * @param poolMgr Address of the PoolManager contract
     */
    function setPoolManager(address poolMgr) external onlyOwner {
        require(poolMgr != address(0), "Invalid PoolManager address");
        address oldManager = poolManager;
        poolManager = poolMgr;
        emit PoolManagerSet(oldManager, poolMgr);
    }
    
    /**
     * @dev Update reward settings - only callable by owner
     * @param newSetting New settings value
     */
    function updateSettings(uint256 newSetting) external onlyOwner {
        require(checkSettingValue(newSetting), "Invalid setting");
        uint256 oldSettings = settings;
        settings = newSetting;
        emit SettingsUpdated(oldSettings, newSetting);
    }
    
    /**
     * @dev Validate settings format
     * @param settingValue Settings value to validate
     * @return valid Whether the settings are valid
     */
    function checkSettingValue(uint256 settingValue) public pure returns (bool valid) {
        // Extract liquidity reward settings
        uint128 liquiditySettings = uint128(settingValue & GATE_SETTINGS_MASK);
        
        // Extract trade reward settings  
        uint128 tradeSettings = uint128((settingValue >> (SHIFT * SETTING_NUMBER)) & GATE_SETTINGS_MASK);
        
        // Validate both settings have proper format
        return validateGateSettings(liquiditySettings) && validateGateSettings(tradeSettings);
    }
    
    /**
     * @dev Validate individual gate settings
     * @param gateSettings Settings to validate
     * @return valid Whether the gate settings are valid
     */
    function validateGateSettings(uint128 gateSettings) internal pure returns (bool valid) {
        uint32 previousGate = 0;
        
        for(uint8 i = 0; i < SETTING_NUMBER; i++) {
            uint64 singleSetting = uint64((gateSettings >> (SHIFT * i)) & SINGLE_SETTING_MASK);
            uint32 gate = uint32(singleSetting >> 8);
            uint8 ratio = uint8(singleSetting & 0xFF);
            
            // Gate must be increasing and ratio must be <= 100%
            if(gate <= previousGate || ratio > 100) {
                return false;
            }
            previousGate = gate;
        }
        return true;
    }
    
    /**
     * @inheritdoc IEasyToken
     */
    function onAddLiquidity(address user, uint256 liquidityValueUSD) external onlyPoolManager {
        uint256 rewardAmount = calculateLiquidityReward(liquidityValueUSD);
        if(rewardAmount > 0) {
            _mint(user, rewardAmount);
            totalRewardsEarned[user] += rewardAmount;
            emit RewardMinted(user, rewardAmount, "liquidity");
        }
    }
    
    /**
     * @inheritdoc IEasyToken
     */
    function onSwap(address user, uint256 swapValueUSD) external onlyPoolManager {
        uint256 rewardAmount = calculateSwapReward(swapValueUSD);
        if(rewardAmount > 0) {
            _mint(user, rewardAmount);
            totalRewardsEarned[user] += rewardAmount;
            emit RewardMinted(user, rewardAmount, "trading");
        }
    }
    
    /**
     * @dev Calculate reward for adding liquidity
     * @param liquidityValueUSD Value of liquidity added in USD
     * @return rewardAmount Amount of EASY tokens to mint
     */
    function calculateLiquidityReward(uint256 liquidityValueUSD) public view returns (uint256 rewardAmount) {
        // Get current TVL from PoolManager
        uint256 currentTVL = getCurrentTVL();
        
        // Extract liquidity reward settings
        uint128 liquiditySettings = uint128(settings & GATE_SETTINGS_MASK);
        
        // Find the appropriate reward rate based on current TVL
        uint8 rewardRate = getRewardRate(liquiditySettings, currentTVL);
        
        // Calculate reward: 1 USD liquidity = rewardRate% EASY tokens
        rewardAmount = (liquidityValueUSD * rewardRate) / 100;
        
        return rewardAmount;
    }
    
    /**
     * @dev Calculate reward for trading/swapping
     * @param swapValueUSD Value of swap in USD
     * @return rewardAmount Amount of EASY tokens to mint
     */
    function calculateSwapReward(uint256 swapValueUSD) public view returns (uint256 rewardAmount) {
        // Get current TVL from PoolManager
        uint256 currentTVL = getCurrentTVL();
        
        // Extract trade reward settings (higher bits)
        uint128 tradeSettings = uint128((settings >> (SHIFT * SETTING_NUMBER)) & GATE_SETTINGS_MASK);
        
        // Find the appropriate reward rate based on current TVL
        uint8 rewardRate = getRewardRate(tradeSettings, currentTVL);
        
        // Calculate reward: 100 USD trading = rewardRate% EASY tokens
        rewardAmount = (swapValueUSD * rewardRate) / (100 * 100); // Divide by 100 for trading multiplier
        
        return rewardAmount;
    }
    
    /**
     * @dev Get reward rate based on TVL and settings
     * @param gateSettings Gate settings to use
     * @param currentTVL Current total value locked
     * @return rewardRate Reward rate percentage
     */
    function getRewardRate(uint128 gateSettings, uint256 currentTVL) internal pure returns (uint8 rewardRate) {
        uint32 previousGate = 0;
        rewardRate = 0; // Default to 0 if no match
        
        for(uint8 i = 0; i < SETTING_NUMBER; i++) {
            uint64 singleSetting = uint64((gateSettings >> (SHIFT * i)) & SINGLE_SETTING_MASK);
            uint32 gate = uint32(singleSetting >> 8);
            uint8 ratio = uint8(singleSetting & 0xFF);
            
            if(currentTVL >= previousGate && currentTVL < gate) {
                rewardRate = ratio;
                break;
            } else if(i == SETTING_NUMBER - 1) {
                // Last setting - use if TVL >= final gate
                rewardRate = ratio;
            }
            
            previousGate = gate;
        }
        
        return rewardRate;
    }
    
    /**
     * @dev Get current TVL from PoolManager
     * @return tvl Current total value locked
     */
    function getCurrentTVL() public view returns (uint256 tvl) {
        if(poolManager == address(0)) return 0;
        
        try IPoolManager(poolManager).getTVL() returns (uint256 currentTVL) {
            return currentTVL;
        } catch {
            return 0;
        }
    }
    
    /**
     * @dev Emergency mint function - only owner
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function emergencyMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev Get user's total rewards earned
     * @param user User address
     * @return totalRewards Total rewards earned by user
     */
    function getUserRewards(address user) external view returns (uint256 totalRewards) {
        return totalRewardsEarned[user];
    }
}