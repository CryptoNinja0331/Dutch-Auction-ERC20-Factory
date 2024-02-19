// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.0;

/**
 * @title Owner
 * @dev Set & change owner
 */

import "hardhat/console.sol";

interface IERC20 {

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // logging events
    event Approval(address indexed _owner, address indexed _spender, uint _value);
    event Transfer(address indexed _from, address indexed _to, uint _value);

}


contract DutchAuction {

    struct Auction {

        uint256 startDate;
        uint256 endDate;
        uint256 startPrice;
        uint256 reservePrice;
        uint256 biddingPrice;
        uint256 totalTokens;
        uint256 remainingTokens;
        uint256 totalBids;
        uint256 totalAmount;
        address token;
        bool auctionComplete;
        
    }

    uint256 public auctionID;
    
    // Maps userAddress to auctionID to reservedTokens;
    mapping (address => mapping (uint256 => uint256)) public reservedTokens;

    // Maps userAddress to auctionID to monetDeposited;
    mapping (address => mapping (uint256 => uint256)) public moneyDeposited;

    // Maps userAddress to auctionID to bidID;
    mapping (address => mapping (uint256 => uint256)) public bidIDList;

    // Maps auctionID to bidID to userAddress;
    mapping (uint256 => mapping (uint256 => address)) public biddersList;

    // Maps auctionOwnerAddress to auctionID
    mapping (address => uint256) public auctionOwner;

    // Maps auctionID to auctionDetails
    mapping (uint256 => Auction) public auctionDetails;
    
    // event to denote auction creation
    event AuctionCreated(uint256 auctionID, uint256 totalTokens, address tokenAddress);

    // event to denote bid creation
    event BidCreated(uint256 bidID, uint256 auctionID, address bidder, uint256 amount, uint256 price, uint256 remainingTokens);
    
    // event to denote end of auction
    event auctionEnded(uint256 auctionID);

    
    function createAuction(
        uint256 _endDate,
        uint256 _startPrice,
        uint256 _reservePrice,
        uint256 _totalTokens,
        address _token
        ) 
    public
    {
        require(auctionOwner[msg.sender] == 0, "Your Auction is still on-going");
        auctionID = auctionID + 1;
        auctionDetails[auctionID] = Auction({
            startDate: block.timestamp,
            endDate: _endDate,
            startPrice : _startPrice,
            reservePrice : _reservePrice,
            biddingPrice : _startPrice,
            totalTokens : _totalTokens,
            remainingTokens : _totalTokens,
            totalBids : 0,
            totalAmount : 0,
            token : _token,
            auctionComplete: false
        });
        
        
        auctionOwner[msg.sender] = auctionID;
        IERC20(_token).transferFrom(msg.sender, address(this), IERC20(_token).allowance(msg.sender, address(this)));
        emit AuctionCreated(auctionID, _totalTokens, _token);
    }
    
    function currentPrice(uint256 _auctionID) 
    public 
    view 
    returns (uint256) {
        
        int256 time_diff = int(auctionDetails[_auctionID].endDate - auctionDetails[_auctionID].startDate);
        int256 price_diff = int(auctionDetails[_auctionID].startPrice - auctionDetails[_auctionID].reservePrice) * -1;
        int slope = int(price_diff/time_diff);
        int intercept = int(auctionDetails[_auctionID].startPrice) - (slope* (int(auctionDetails[_auctionID].startDate)));
        int price = int(slope * int(block.timestamp) + intercept);
        if (price < int(auctionDetails[_auctionID].reservePrice)) {
            price = int(auctionDetails[_auctionID].reservePrice);
        }
        return uint(price);

    }

    function createBid(uint256 _auctionID, uint256 _amount) 
    payable
    external
    onlyNonAuctionOwners(_auctionID)
    {
        require(auctionDetails[_auctionID].auctionComplete == false, "Auction is over");
        require(reservedTokens[msg.sender][_auctionID] == 0, "One can only bid once");
        require(_amount <= auctionDetails[_auctionID].remainingTokens, "Auction does not have sufficient tokens");
        uint256 price = currentPrice(_auctionID);
        require(msg.value >= price * _amount, "more money required");
        auctionDetails[_auctionID].biddingPrice = price;
        reservedTokens[msg.sender][_auctionID] = _amount;
        moneyDeposited[msg.sender][_auctionID] = msg.value;
        auctionDetails[_auctionID].remainingTokens = auctionDetails[_auctionID].remainingTokens - _amount;
        auctionDetails[_auctionID].totalBids = auctionDetails[_auctionID].totalBids + 1;
        uint256 bidID = auctionDetails[_auctionID].totalBids;
        auctionDetails[_auctionID].totalAmount = auctionDetails[_auctionID].totalAmount + msg.value;
        bidIDList[msg.sender][_auctionID] = bidID;
        biddersList[_auctionID][bidID] = msg.sender;

        emit BidCreated(bidID, _auctionID, msg.sender, _amount, price, auctionDetails[_auctionID].remainingTokens);

    }

    function endAuction(uint256 _auctionID) 
    external
    onlyAuctionOwners(_auctionID) 
    {

        require(auctionDetails[_auctionID].auctionComplete == false, "Auction is over");
        if (auctionDetails[_auctionID].remainingTokens == 0) {
            
            uint256 bidding_price = auctionDetails[_auctionID].biddingPrice;
            address tokenAddress = auctionDetails[_auctionID].token;

            for (uint i = 1; i<=auctionDetails[_auctionID].totalBids; i++){
                
                address bidder = biddersList[_auctionID][i];
                uint256 bidderTokens = reservedTokens[bidder][_auctionID];
                uint256 amountPaid = moneyDeposited[bidder][_auctionID];
                IERC20(tokenAddress).transfer(bidder, bidderTokens * 10**18);
                reservedTokens[bidder][_auctionID] = 0;
                uint256 refundAmt = amountPaid - (bidding_price*bidderTokens);
                (bool token_success, ) = payable(bidder).call{value: refundAmt}("");
                require(token_success, "Transfer failed.");
                moneyDeposited[bidder][_auctionID] = 0;
                auctionDetails[_auctionID].totalAmount = auctionDetails[_auctionID].totalAmount - refundAmt;

            }
            uint256 ownerWithdrawBalance = auctionDetails[_auctionID].totalAmount;
            auctionDetails[_auctionID].totalAmount = 0;
            (bool eth_success, ) = msg.sender.call{value: ownerWithdrawBalance}("");
            require(eth_success, "Transfer failed.");
            ownerWithdrawBalance = 0;
            auctionOwner[msg.sender] = 0;
            auctionDetails[_auctionID].auctionComplete = true;
            emit auctionEnded(_auctionID);

        }
        else if (block.timestamp > auctionDetails[_auctionID].endDate) {

            uint256 bidding_price = auctionDetails[_auctionID].biddingPrice;
            address tokenAddress = auctionDetails[_auctionID].token;
            for (uint i = 1; i<=auctionDetails[_auctionID].totalBids; i++){
                
                address bidder = biddersList[_auctionID][i];
                uint256 bidderTokens = reservedTokens[bidder][_auctionID];
                uint256 amountPaid = moneyDeposited[bidder][_auctionID];
                IERC20(tokenAddress).transfer(bidder, bidderTokens * 10**18);
                reservedTokens[bidder][_auctionID] = 0;
                uint256 refundAmt = amountPaid - (bidding_price*bidderTokens);
                (bool token_success2, ) = payable(bidder).call{value: refundAmt}("");
                require(token_success2, "Transfer failed.");
                moneyDeposited[bidder][_auctionID] = 0;
                auctionDetails[_auctionID].totalAmount = auctionDetails[_auctionID].totalAmount - refundAmt;

            }
            IERC20(tokenAddress).transfer(msg.sender, auctionDetails[_auctionID].remainingTokens * 10**18);
            auctionDetails[_auctionID].remainingTokens = 0;
            uint256 ownerWithdrawBalance = auctionDetails[_auctionID].totalAmount;
            auctionDetails[_auctionID].totalAmount = 0;
            (bool eth_success2, ) = msg.sender.call{value: ownerWithdrawBalance}("");
            require(eth_success2, "Transfer failed.");
            ownerWithdrawBalance = 0;
            auctionOwner[msg.sender] = 0;
            auctionDetails[_auctionID].auctionComplete = true;
            emit auctionEnded(_auctionID);
        }

        else {
            revert("Auction is on-going. You can end the auction after all tokens are sold or after auction reaches end time");
        }
        
    }

    // modifier to allow only auction owners to access the function
    modifier onlyAuctionOwners(uint256 _auctionID){

        require(auctionOwner[msg.sender] == _auctionID, "You are not the Auction Owner");
        _;

    }

    // modifier to allow only non-auction-owners to access the function
    modifier onlyNonAuctionOwners(uint256 _auctionID){

        require(auctionOwner[msg.sender] != _auctionID, "Auction Owner cannot make a bid");
        _;

    }
}