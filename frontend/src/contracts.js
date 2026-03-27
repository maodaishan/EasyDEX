// Contract configuration
const CONTRACT_CONFIG = {
    // Contract addresses (loaded from deployment)
    addresses: {
        PriceHelper: "0x70e0bA845a1A0F2DA3359C97E0285013525FFC49",
        ELFToken: "0x4826533B4897376654Bb4d4AD88B7faFD0C98528",
        EasyToken: "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
        PoolManager: "0x0E801D84Fa97b50751Dbf25036d067dCf18858bF",
        Governance: "0x7969c5eD335650692Bc04293B07F5BF2e7A673C0",
        TestTokens: {
            TokenA: "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570",
            TokenB: "0x809d550fca64d94Bd9F66E60752A544199cfAC3D", 
            USDC: "0x4c5859f0F772848b2D91F1D83E2Fe57935348029"
        }
    },
    // Network configuration
    network: {
        chainId: 31337, // Hardhat local network
        name: "Localhost",
        rpcUrl: "http://127.0.0.1:8545"
    }
};

// Contract ABIs (simplified for demo)
const CONTRACT_ABIS = {
    ERC20: [
        "function name() view returns (string)",
        "function symbol() view returns (string)", 
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function mint(address, uint256)",
        // Events
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ],
    
    PriceHelper: [
        "function getPrice(address) view returns (uint256, uint8)",
        "function setMockPrice(address, uint256, uint8)",
        "function getMockPrice(address) view returns (uint256, uint8)",
        // Events
        "event MockPriceSet(address indexed token, uint256 price, uint8 decimal)"
    ],
    
    ELFToken: [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function owner() view returns (address)",
        "function pause()",
        "function unpause()",
        "function paused() view returns (bool)",
        // Events
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)"
    ],
    
    EasyToken: [
        "function name() view returns (string)",
        "function symbol() view returns (string)", 
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address, uint256) returns (bool)",
        "function approve(address, uint256) returns (bool)",
        "function allowance(address, address) view returns (uint256)",
        "function poolManager() view returns (address)",
        "function setPoolManager(address)",
        "function settings() view returns (uint256)",
        "function updateSettings(uint256)",
        "function checkSettingValue(uint256) view returns (bool)",
        "function onAddLiquidity(address, uint256)",
        "function onSwap(address, uint256)",
        "function calculateLiquidityReward(uint256) view returns (uint256)",
        "function calculateSwapReward(uint256) view returns (uint256)",
        "function getCurrentTVL() view returns (uint256)",
        "function emergencyMint(address, uint256)",
        "function getUserRewards(address) view returns (uint256)",
        "function totalRewardsEarned(address) view returns (uint256)",
        // Events
        "event Transfer(address indexed from, address indexed to, uint256 value)",
        "event Approval(address indexed owner, address indexed spender, uint256 value)",
        "event PoolManagerSet(address indexed oldManager, address indexed newManager)",
        "event RewardMinted(address indexed user, uint256 amount, string reason)",
        "event SettingsUpdated(uint256 oldSettings, uint256 newSettings)"
    ],
    
    PoolManager: [
        "function ELFAddress() view returns (address)",
        "function EASYAddress() view returns (address)",
        "function fee() view returns (tuple(uint8 decimal, uint24 fee))",
        "function pools(uint256) view returns (tuple(address poolAddr, address tokenAddr))",
        "function getPoolCount() view returns (uint256)",
        "function getPoolByIndex(uint256) view returns (address)",
        "function getAllPools() view returns (address[])",
        "function isValidPool(address) view returns (bool)",
        "function addPool(address, uint256) returns (address)",
        "function removePool(address)",
        "function mintELF(address, uint256)",
        "function burnELF(address, uint256)",
        "function mintEasyReward(address, uint256)",
        "function getTotalEasyRewards() view returns (uint256)",
        "function getTVL() view returns (uint256)",
        "function getTokenPrice(address) view returns (uint256, uint8)",
        // Events
        "event PoolAdded(address indexed tokenAddr, address indexed poolAddr, uint256 settings)",
        "event PoolSettingsUpdated(address indexed poolAddr, uint256 newSettings)"
    ],
    
    Pool: [
        "function tokenAddress() view returns (address)",
        "function poolManager() view returns (address)",
        "function liquidity() view returns (uint256)",
        "function settings() view returns (uint256)",
        "function addLiquidity(address, uint256) payable returns (uint256)",
        "function removeLiquidity(address, uint256) returns (uint256)",
        "function withdraw()",
        "function updateSettings(uint256) returns (bool)",
        "function estimateSlippage(tuple(uint256 inPoolValue, uint256 inPrice, uint256 inAmount, uint8 inDecimal, uint256 price, uint8 decimal)) view returns (uint256, uint8)",
        "function getPoolValue(uint256, uint8) view returns (uint256)",
        "function getPoolInfo(address) view returns (tuple(uint256 totalTokens, uint256 totalShares, uint256 lastUpdate))",
        // Events
        "event liquidityUpdated(address indexed poolAddress, uint256 indexed oldLiquidity, uint256 indexed newLiquidity)",
        "event settingsUpdated(address indexed poolAddress, uint256 indexed oldSettings, uint256 indexed newSettings)"
    ],
    
    Governance: [
        "function easyToken() view returns (address)",
        "function getProposalCount() view returns (uint256)",
        "function getProposal(uint256) view returns (tuple(address proposer, string description, uint256 forVotes, uint256 againstVotes, uint256 startTime, uint256 endTime, bool executed, bool canceled))",
        "function initProposal(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
        "function proveProposal(uint256, string)",
        "function voteProposal(uint256, bool, uint256)",
        "function execProposal(uint256)",
        "function getVotingPower(address) view returns (uint256)",
        "function hasVoted(uint256, address) view returns (bool)",
        // Events
        "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description)",
        "event ProposalProved(uint256 indexed proposalId, string proof)",
        "event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes)",
        "event ProposalExecuted(uint256 indexed proposalId)"
    ]
};

// Token information
const TOKENS = {
    TKA: {
        address: CONTRACT_CONFIG.addresses.TestTokens.TokenA,
        name: "Test Token A",
        symbol: "TKA", 
        decimals: 18,
        logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23007bff'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='8'%3ETKA%3C/text%3E%3C/svg%3E",
        price: 1.00
    },
    TKB: {
        address: CONTRACT_CONFIG.addresses.TestTokens.TokenB,
        name: "Test Token B", 
        symbol: "TKB",
        decimals: 18,
        logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%2328a745'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='8'%3ETKB%3C/text%3E%3C/svg%3E",
        price: 2.00
    },
    USDC: {
        address: CONTRACT_CONFIG.addresses.TestTokens.USDC,
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewView='0 0 24 24' fill='%23ffc107'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='6'%3EUSDC%3C/text%3E%3C/svg%3E",
        price: 1.00
    },
    ELF: {
        address: CONTRACT_CONFIG.addresses.ELFToken,
        name: "EasyDEX Liquidity Token",
        symbol: "ELF",
        decimals: 18,
        logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%236366f1'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='8'%3EELF%3C/text%3E%3C/svg%3E"
    },
    EASY: {
        address: CONTRACT_CONFIG.addresses.EasyToken,
        name: "EasyDEX Governance Token",
        symbol: "EASY", 
        decimals: 18,
        logo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23f59e0b'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Ctext x='12' y='16' text-anchor='middle' fill='white' font-size='6'%3EEASY%3C/text%3E%3C/svg%3E"
    }
};

// Utility functions
function getTokenByAddress(address) {
    return Object.values(TOKENS).find(token => token.address.toLowerCase() === address.toLowerCase());
}

function getTokenBySymbol(symbol) {
    return TOKENS[symbol];
}

function formatTokenAmount(amount, decimals = 18) {
    return ethers.utils.formatUnits(amount, decimals);
}

function parseTokenAmount(amount, decimals = 18) {
    return ethers.utils.parseUnits(amount.toString(), decimals);
}

// Export configuration
window.CONTRACT_CONFIG = CONTRACT_CONFIG;
window.CONTRACT_ABIS = CONTRACT_ABIS;
window.TOKENS = TOKENS;
window.getTokenByAddress = getTokenByAddress;
window.getTokenBySymbol = getTokenBySymbol;
window.formatTokenAmount = formatTokenAmount;
window.parseTokenAmount = parseTokenAmount;