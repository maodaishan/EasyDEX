// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./interfaces/IGovernance.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Governance is IGovernance,Ownable{
    mapping(address => bool) private allowedAddress;    //proposal address should be in this map,which can be called.
                                                        //should be Pools,PoolManager.
    mapping(uint32 => Proposal) private proposals;
    address private immutable easyToken;    //only can vote by EASY token
    uint32 nextProposalIndex = 1;
    struct Proposal{
        bool confirmed;
        bool executed;
        uint32 index;
        address targetContract;
        uint256 gate;
        uint256 voted;
        uint256 contentHash;
        bytes param;
    }

    constructor(address easy){
        easyToken = easy;
    }

    function addAllowedAddress(address addr) onlyOwner external{
        allowedAddress[addr]=true;
    }

    function initProposal(
        uint256 contentHash,
        uint256 gate,
        address targetContract,
        bytes calldata param
    ) external returns(uint32 proposalIndex){
        require(allowedAddress[targetContract] == true,'not allowed target to call');
        require(IERC20(easyToken).balanceOf(msg.sender) > 0,'only EASY holder can initProposal');
        require(IERC20(easyToken).totalSupply() >= gate, 'gate too big');

        Proposal storage p = proposals[nextProposalIndex];
        p.confirmed = false;
        p.index = nextProposalIndex;
        p.targetContract = targetContract;
        p.gate = gate;
        p.voted = 0;
        p.contentHash = contentHash;
        p.param = param;

        nextProposalIndex++;
        return p.index;
    }

    function confirmProposal(
        uint32 proposalIndex
    ) external onlyOwner{
        Proposal storage p = proposals[proposalIndex];
        p.confirmed = true;
    }

    function voteProposal(
        uint32 proposalIndex
    ) external{
        uint256 balance = IERC20(easyToken).balanceOf(msg.sender);
        require(balance > 0, 'only EASY holder can vote');
        Proposal storage p = proposals[proposalIndex];
        p.voted = p.voted + balance;
    }

    function executeProposal(
        uint32 proposalIndex
    ) external onlyOwner{
        Proposal storage p = proposals[proposalIndex];
        require(!p.executed,'already executed');
        require(p.confirmed && p.voted >= p.gate, 'proposal can not be executed');

        (bool success,) = p.targetContract.call(p.param);
        if(!success){
            revert('exec failed');
        }
        p.executed = true;
    }
}
