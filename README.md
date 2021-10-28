# Dolomite Liquidator Subgraph

This sub-graph is designed to track the account values and expirations of all Dolomite margin accounts, so liquidation
bots can consume the data for submitting timely and accurate liquidations.

## Running Locally

Make sure to update package.json settings to point to your own graph account.

## Queries

Below are a few ways to show how to query the uniswap-subgraph for data. The queries show most of the information that 
is queryable, but there are many other filtering options that can be used, just check out the 
[querying api](https://thegraph.com/docs/graphql-api). These queries can be used locally or in The Graph Explorer 
playground.

## Key Entity Overviews


#### Token

Contains data on a specific token. Token data is updated whenever an event fires for adding a new token to the system.

## Example Queries

### Querying Aggregated Data

This query fetches all active margin accounts that currently have debt.

```graphql
{
    marginAccounts(where: { hasBorrowedValue: true }) {
        id
        user {
            id
        }
        accountNumber
        tokenValues {
            token {
                marketId
                decimals
            }
            valuePar
            expirationTimestamp
            expiryAddress
        }
    }
}
```
