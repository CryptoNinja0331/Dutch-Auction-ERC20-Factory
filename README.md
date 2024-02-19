# Dutch Pot Auction [Reverse Auction -- The price of asset decrease with time]
![Dutch Auction Algorand](https://user-images.githubusercontent.com/30176438/152404035-f2bc9c31-092f-44d9-9da9-86f7e410ac10.gif)



## How Does This Auction Work?

- Using this Dutch Auction Contract, anyone can create an auction and sell their ERC20 tokens.
- A user cannot start another auction when their current auction is live
- The price of the listed item in the auction decreases linearly with time
- Everyone except the auction owner can bid in the listed auction.
- In each auction, each user can only bid once.


## Auction Explained in Detail
1. Any user can start an auction by depositing an ERC20 token to the Smart Contract
2. From a single user address, only one auction can be created.
3. Any user except the Auction Owner can participate in the auction. Multiple users need to participate in the auction to fill the pot.
4. In each auction, each user can only bid once.
5. Bid = Requested Number Of Tokens * Token Price at that time
6. The price of the erc20 token decreases linearly with time, until it reaches end time.
7. If auction goes past the end time, then `buying price = reserve price`
8. Auction can only be ended by Auction Owner.
9. Auction can only be ended after all tokens are reserved or after auction reaches end time.
10. At the end of auction, ERC20 tokens reserved to each bidder is sent to their address.
11. At the end of auction, if `user's buying price > last bidding price` for the ERC20 token, the extra Eth collected from bidders during bidding will be refunded.
12. At the end of auction, after distributing the refund Eth to bidders, remaining Eth is transferred to Auction Owner.
13. At the end of auction, if there are unreserved(unsold) ERC20 tokens, these tokens are sent back to Auction Owner
   
<br />

## Tests Covering The Dutch Auction Smart Contract [TOTAL TESTS: 49]

- MINT TOKENS & CHECK OWNER BALANCE
- CREATE AUCTION 
  - APPROVE TOKENS & CREATE 2 AUCTIONS
    - first auction has limited tokens and long enddate ---> it is ended before enddate, but all tokens are sold
    - second auction has many tokens and short enddate ---> it is ended after enddate, but has unsold tokens
    - third auction has many tokens and long enddate ---> it is ended before enddate, but all tokens are sold
    <br />
    Auction 3 Is Added To Show That This Contract Can Handle Multiple Live Auctions Simultaneously.
    <br />
    Auction 3 Starts Along With Auction 2, This Auction Remains Live Throughout Auction 2 Lifetime. And, It Ends After All Tokens Are Sold.
  - check if auction is live
  - verify auction details
  - verify auctionOwner
  - check if erc20 tokens are transferred to contract
  - verify event
- TOTAL AUCTIONS
  - verify auctionID
- CURRENT PRICE
  - check if price decreases at intervals
  - check if price reaches reserve price after endDate
- CREATE BID
  - check if onlyNonAuctionOwners(_auctionID) can access this function
  - check if auction is live
  - check if bidder has any previous bids
  - check if auction has sufficient tokens for bidder
  - MAKE 6 BIDS
    - make 2 bids from 2 accounts to auction 1
    - make 2 bids from 2 accounts to auction 2
    - make 2 bids from 2 accounts to auction 3
  - check if ether transferred is greater than bidding_price * amount
  - check if auctionDetails[_auctionID].totalAmount matches 
  - check if sender address is included in biddersList using bidIDList
  - verify event
- END AUCTION
  - check if onlyAuctionOwners can access this function
  - check if auction is live
  - END AUCTION
  - 3 AUCTIONS
    - FIRST AUCTION --> WITH NO REMAINING TOKENS AND HAS NOT REACHED ENDDATE
      - check if refund eth has been transferred from smart contract
      - check if refund eth has been transferred to respective accounts
      - check if erc20 has been transferred from smart contract
      - check if erc20 has been transferred to respective accounts
      - check if owner receives the balance eth
      - check if auction is complete <br />
    - SECOND AUCTION --> WITH REMAINING TOKENS BUT PAST ENDDATE - [PRICE = RESERVE PRICE, AFTER ENDDATE]
      - check if auction has remaining tokens
      - check if erc20 has been transferred from smart contract
      - check if erc20 has been transferred to respective account
      - check if refund eth has been transferred from smart contract
      - check if refund eth has been transferred to respective account
      - check if owner receives the balance erc20
      - check if owner receives the balance eth
      - check if auction is complete
    - THIRD AUCTION --> WITH NO REMAINING TOKENS AND HAS NOT REACHED ENDDATE
      - check if refund eth has been transferred from smart contract
      - check if refund eth has been transferred to respective accounts
      - check if erc20 has been transferred from smart contract
      - check if erc20 has been transferred to respective accounts
      - check if owner receives the balance eth
      - check if auction is complete



Instructions To Run This Repo
```shell
git clone https://github.com/ShivaShanmuganathan/DutchAuction.git
```
```shell
npm install
```
```shell
npx hardhat --version
```
```shell
npx hardhat compile
```
```shell
npx hardhat test
```
