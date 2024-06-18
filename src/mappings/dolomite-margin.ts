/* eslint-disable prefer-const,@typescript-eslint/no-non-null-assertion */
import {
  DolomiteMargin as DolomiteMarginProtocol,
  ExpirySet as ExpirySetEvent,
  LogAddMarket as AddMarketEvent,
  LogBuy as BuyEvent,
  LogDeposit as DepositEvent,
  LogLiquidate as LiquidationEvent,
  LogRemoveMarket as RemoveMarketEvent,
  LogSell as SellEvent,
  LogSetEarningsRate as EarningsRateUpdateEvent,
  LogSetIsClosing as IsClosingUpdateEvent,
  LogSetLiquidationSpread as LiquidationSpreadUpdateEvent,
  LogSetMarginPremium as MarginPremiumUpdateEvent,
  LogSetMarginRatio as MarginRatioUpdateEvent,
  LogSetMinBorrowedValue as MinBorrowedValueUpdateEvent,
  LogSetSpreadPremium as MarketSpreadPremiumUpdateEvent,
  LogTrade as TradeEvent,
  LogTransfer as TransferEvent,
  LogVaporize as VaporizationEvent,
  LogWithdraw as WithdrawEvent
} from '../types/MarginTrade/DolomiteMargin'
import {
  MarginAccount,
  MarginAccountTokenValue,
  MarketRiskInfo,
  Token,
  TokenMarketIdReverseMap,
  Transaction, User
} from '../types/schema'
import {
  BD_ONE_ETH,
  fetchTokenDecimals,
  fetchTokenName,
  fetchTokenSymbol,
  getOrCreateDolomiteMarginForCall,
  getOrCreateTransaction,
  ONE_BD,
  ZERO_BD,
  ZERO_BI
} from './helpers'
import { DOLOMITE_MARGIN_ADDRESS } from './generated/constants'
import { BalanceUpdate } from './dolomite-margin-types'
import { Address, BigDecimal, BigInt, ethereum, log, store } from '@graphprotocol/graph-ts'

export function getOrCreateMarginAccount(owner: Address, accountNumber: BigInt, block: ethereum.Block): MarginAccount {
  const id = `${owner.toHexString()}-${accountNumber.toString()}`
  let marginAccount = MarginAccount.load(id)
  if (marginAccount === null) {
    let user = User.load(owner.toHexString())
    if (user === null) {
      user = new User(owner.toHexString())
      user.save()
    }

    marginAccount = new MarginAccount(id)
    marginAccount.user = user.id
    marginAccount.accountNumber = accountNumber
    marginAccount.borrowTokens = []
    marginAccount.supplyTokens = []
    marginAccount.expirationTokens = []
    marginAccount.hasBorrowValue = false
    marginAccount.hasSupplyValue = false
    marginAccount.hasExpiration = false
  }

  marginAccount.lastUpdatedBlockNumber = block.number
  marginAccount.lastUpdatedTimestamp = block.timestamp

  return marginAccount
}

function getOrCreateTokenValue(
  marginAccount: MarginAccount,
  token: Token,
  transaction: Transaction
): MarginAccountTokenValue {
  const id = `${marginAccount.user}-${marginAccount.accountNumber.toString()}-${token.marketId.toString()}`
  let tokenValue = MarginAccountTokenValue.load(id)
  if (tokenValue === null) {
    tokenValue = new MarginAccountTokenValue(id)
    tokenValue.marginAccount = marginAccount.id
    tokenValue.marketId = token.marketId
    tokenValue.token = token.id
    tokenValue.valuePar = ZERO_BD
    tokenValue.allUpdateTransactions = []
  }
  tokenValue.lastUpdateTransaction = transaction.id
  tokenValue.allUpdateTransactions = tokenValue.allUpdateTransactions.concat([transaction.id])

  return tokenValue
}

function handleDolomiteMarginBalanceUpdateForAccount(
  balanceUpdate: BalanceUpdate,
  event: ethereum.Event
): MarginAccount {
  let marginAccount = getOrCreateMarginAccount(balanceUpdate.accountOwner, balanceUpdate.accountNumber, event.block)

  let tokenAddress = TokenMarketIdReverseMap.load(balanceUpdate.market.toString())!.token
  let token = Token.load(tokenAddress) as Token
  let transaction = getOrCreateTransaction(event)
  let tokenValue = getOrCreateTokenValue(marginAccount, token, transaction)
  let oldPar = tokenValue.valuePar

  if (oldPar.lt(ZERO_BD) && balanceUpdate.valuePar.ge(ZERO_BD)) {
    // The user is going from a negative balance to a positive one. Remove from the list
    let index = marginAccount.borrowTokens.indexOf(token.id)
    if (index != -1) {
      let copy = marginAccount.borrowTokens
      copy.splice(index, 1)
      // NOTE we must use the copy here because the return value of #splice isn't the new array. Rather, it returns the
      // DELETED element only
      marginAccount.borrowTokens = copy
    }
  } else if (oldPar.ge(ZERO_BD) && balanceUpdate.valuePar.lt(ZERO_BD)) {
    // The user is going from a positive balance to a negative one, add it to the list
    marginAccount.borrowTokens = marginAccount.borrowTokens.concat([token.id])
  }
  marginAccount.hasBorrowValue = marginAccount.borrowTokens.length > 0

  if (tokenValue.valuePar.le(ZERO_BD) && balanceUpdate.valuePar.gt(ZERO_BD)) {
    // The user is going from a zero or negative balance to a positive one. Add to the list
    marginAccount.supplyTokens = marginAccount.supplyTokens.concat([token.id])
  } else if (tokenValue.valuePar.gt(ZERO_BD) && balanceUpdate.valuePar.le(ZERO_BD)) {
    // The user is going from a positive balance to a zero or negative one, remove it from the list
    let index = marginAccount.supplyTokens.indexOf(token.id)
    if (index != -1) {
      let copy = marginAccount.supplyTokens
      copy.splice(index, 1)
      // NOTE we must use the copy here because the return value of #splice isn't the new array. Rather, it returns the
      // DELETED element only
      marginAccount.supplyTokens = copy
    }
  }
  marginAccount.hasSupplyValue = marginAccount.supplyTokens.length > 0

  tokenValue.valuePar = balanceUpdate.valuePar
  log.info(
    'Balance changed for account {} to value {}',
    [marginAccount.id, tokenValue.valuePar.toString()]
  )

  marginAccount.save()
  tokenValue.save()

  return marginAccount
}

export function handleMarketAdded(event: AddMarketEvent): void {
  log.info(
    'Adding market[{}] for token {} for hash and index: {}-{}',
    [event.params.marketId.toString(), event.params.token.toHexString(), event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  if (event.address.toHexString() != DOLOMITE_MARGIN_ADDRESS) {
    log.error('Invalid DolomiteMargin address, found {} and {}', [event.address.toHexString(), DOLOMITE_MARGIN_ADDRESS])
    return
  }


  let protocol = DolomiteMarginProtocol.bind(event.address)
  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.numberOfMarkets = protocol.getNumMarkets().toI32()
  dolomiteMargin.save()

  let tokenAddress = event.params.token
  let token = Token.load(tokenAddress.toHexString())
  if (token === null) {
    log.info('Adding new token to store {}', [tokenAddress.toHexString()])
    token = new Token(tokenAddress.toHexString())
    token.marketId = event.params.marketId
    token.name = fetchTokenName(tokenAddress)
    token.symbol = fetchTokenSymbol(tokenAddress)
    let decimals = fetchTokenDecimals(tokenAddress)
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      log.error('the decimal on token was null', [])
      return
    }
    token.decimals = decimals
    token.save()

    let mapper = new TokenMarketIdReverseMap(token.marketId.toString())
    mapper.token = token.id
    mapper.save()
  }

  let marketInfo = new MarketRiskInfo(tokenAddress.toHexString())
  marketInfo.token = tokenAddress.toHexString()
  marketInfo.marginPremium = BigDecimal.fromString('0')
  marketInfo.liquidationRewardPremium = BigDecimal.fromString('0')
  marketInfo.isBorrowingDisabled = false
  marketInfo.save()
}

export function handleMarketRemoved(event: RemoveMarketEvent): void {
  log.info(
    'Removing market[{}] for token {} for hash and index: {}-{}',
    [event.params.marketId.toString(), event.params.token.toHexString(), event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.numberOfMarkets = dolomiteMargin.numberOfMarkets + 1
  dolomiteMargin.save()

  let id = TokenMarketIdReverseMap.load(event.params.marketId.toString())!.token
  store.remove('TokenMarketIdReverseMap', id)
  store.remove('MarketRiskInfo', id)
}

export function handleSetIsMarketClosing(event: IsClosingUpdateEvent): void {
  log.info(
    'Handling set_market_closing for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let tokenAddress = TokenMarketIdReverseMap.load(event.params.marketId.toString())!.token
  let marketInfo = MarketRiskInfo.load(tokenAddress) as MarketRiskInfo
  marketInfo.isBorrowingDisabled = event.params.isClosing
  marketInfo.save()
}

export function handleSetEarningsRate(event: EarningsRateUpdateEvent): void {
  log.info(
    'Handling earnings rate change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let earningsRateBD = new BigDecimal(event.params.earningsRate.value)
  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.earningsRate = earningsRateBD.div(BD_ONE_ETH) // it's a ratio where ONE_ETH is 100%
  dolomiteMargin.save()
}

export function handleSetLiquidationReward(event: LiquidationSpreadUpdateEvent): void {
  log.info(
    'Handling liquidation ratio change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let liquidationPremiumBD = new BigDecimal(event.params.liquidationSpread.value)

  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.liquidationReward = liquidationPremiumBD.div(BD_ONE_ETH).plus(ONE_BD)
  dolomiteMargin.save()
}

export function handleSetLiquidationRatio(event: MarginRatioUpdateEvent): void {
  log.info(
    'Handling liquidation ratio change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let liquidationRatioBD = new BigDecimal(event.params.marginRatio.value)

  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.liquidationRatio = liquidationRatioBD.div(BD_ONE_ETH).plus(ONE_BD)
  dolomiteMargin.save()
}

export function handleSetMinBorrowedValue(event: MinBorrowedValueUpdateEvent): void {
  log.info(
    'Handling min borrowed value change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let minBorrowedValueBD = new BigDecimal(event.params.minBorrowedValue.value)

  let dolomiteMargin = getOrCreateDolomiteMarginForCall()
  dolomiteMargin.minBorrowedValue = minBorrowedValueBD.div(BD_ONE_ETH).div(BD_ONE_ETH)
  dolomiteMargin.save()
}

export function handleSetMarginPremium(event: MarginPremiumUpdateEvent): void {
  log.info(
    'Handling margin premium change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let tokenAddress = TokenMarketIdReverseMap.load(event.params.marketId.toString())!.token
  let marketInfo = MarketRiskInfo.load(tokenAddress) as MarketRiskInfo
  let marginPremiumBD = new BigDecimal(event.params.marginPremium.value)
  marketInfo.marginPremium = marginPremiumBD.div(BD_ONE_ETH)
  marketInfo.save()
}

export function handleSetLiquidationSpreadPremium(event: MarketSpreadPremiumUpdateEvent): void {
  log.info(
    'Handling liquidation spread premium change for hash and index: {}-{}',
    [event.transaction.hash.toHexString(), event.logIndex.toString()]
  )

  let tokenAddress = TokenMarketIdReverseMap.load(event.params.marketId.toString())!.token
  let marketInfo = MarketRiskInfo.load(tokenAddress) as MarketRiskInfo
  let spreadPremiumBD = new BigDecimal(event.params.spreadPremium.value)
  marketInfo.liquidationRewardPremium = spreadPremiumBD.div(BD_ONE_ETH)
  marketInfo.save()
}

export function handleDeposit(event: DepositEvent): void {
  let tokenAddress = TokenMarketIdReverseMap.load(event.params.market.toString())!.token
  let token = Token.load(tokenAddress) as Token
  const balanceUpdate = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    token,
    event.params.update.newPar.value,
    event.params.update.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdate, event)
}

export function handleWithdraw(event: WithdrawEvent): void {
  let tokenAddress = TokenMarketIdReverseMap.load(event.params.market.toString())!.token
  let token = Token.load(tokenAddress) as Token

  const balanceUpdate = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    token,
    event.params.update.newPar.value,
    event.params.update.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdate, event)
}

export function handleTransfer(event: TransferEvent): void {
  let tokenAddress = TokenMarketIdReverseMap.load(event.params.market.toString())!.token
  let token = Token.load(tokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.accountOneOwner,
    event.params.accountOneNumber,
    token,
    event.params.updateOne.newPar.value,
    event.params.updateOne.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.accountTwoOwner,
    event.params.accountTwoNumber,
    token,
    event.params.updateTwo.newPar.value,
    event.params.updateTwo.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)
}

export function handleBuy(event: BuyEvent): void {
  let makerTokenAddress = TokenMarketIdReverseMap.load(event.params.makerMarket.toString())!.token
  let makerToken = Token.load(makerTokenAddress) as Token

  let takerTokenAddress = TokenMarketIdReverseMap.load(event.params.takerMarket.toString())!.token
  let takerToken = Token.load(takerTokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    makerToken,
    event.params.makerUpdate.newPar.value,
    event.params.makerUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    takerToken,
    event.params.takerUpdate.newPar.value,
    event.params.takerUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)
}

export function handleSell(event: SellEvent): void {
  let makerTokenAddress = TokenMarketIdReverseMap.load(event.params.makerMarket.toString())!.token
  let makerToken = Token.load(makerTokenAddress) as Token

  let takerTokenAddress = TokenMarketIdReverseMap.load(event.params.takerMarket.toString())!.token
  let takerToken = Token.load(takerTokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    makerToken,
    event.params.makerUpdate.newPar.value,
    event.params.makerUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.accountOwner,
    event.params.accountNumber,
    takerToken,
    event.params.takerUpdate.newPar.value,
    event.params.takerUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)
}

export function handleTrade(event: TradeEvent): void {
  let inputTokenAddress = TokenMarketIdReverseMap.load(event.params.inputMarket.toString())!.token
  let inputToken = Token.load(inputTokenAddress) as Token

  let outputTokenAddress = TokenMarketIdReverseMap.load(event.params.outputMarket.toString())!.token
  let outputToken = Token.load(outputTokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.makerAccountOwner,
    event.params.makerAccountNumber,
    inputToken,
    event.params.makerInputUpdate.newPar.value,
    event.params.makerInputUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.makerAccountOwner,
    event.params.makerAccountNumber,
    outputToken,
    event.params.makerOutputUpdate.newPar.value,
    event.params.makerOutputUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)

  const balanceUpdateThree = new BalanceUpdate(
    event.params.takerAccountOwner,
    event.params.takerAccountNumber,
    inputToken,
    event.params.takerInputUpdate.newPar.value,
    event.params.takerInputUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateThree, event)

  const balanceUpdateFour = new BalanceUpdate(
    event.params.takerAccountOwner,
    event.params.takerAccountNumber,
    outputToken,
    event.params.takerOutputUpdate.newPar.value,
    event.params.takerOutputUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateFour, event)
}

export function handleLiquidate(event: LiquidationEvent): void {
  let heldTokenAddress = TokenMarketIdReverseMap.load(event.params.heldMarket.toString())!.token
  let heldToken = Token.load(heldTokenAddress) as Token

  let owedTokenAddress = TokenMarketIdReverseMap.load(event.params.owedMarket.toString())!.token
  let owedToken = Token.load(owedTokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.liquidAccountOwner,
    event.params.liquidAccountNumber,
    heldToken,
    event.params.liquidHeldUpdate.newPar.value,
    event.params.liquidHeldUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.liquidAccountOwner,
    event.params.liquidAccountNumber,
    owedToken,
    event.params.liquidOwedUpdate.newPar.value,
    event.params.liquidOwedUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)

  const balanceUpdateThree = new BalanceUpdate(
    event.params.solidAccountOwner,
    event.params.solidAccountNumber,
    heldToken,
    event.params.solidHeldUpdate.newPar.value,
    event.params.solidHeldUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateThree, event)

  const balanceUpdateFour = new BalanceUpdate(
    event.params.solidAccountOwner,
    event.params.solidAccountNumber,
    owedToken,
    event.params.solidOwedUpdate.newPar.value,
    event.params.solidOwedUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateFour, event)
}

export function handleVaporize(event: VaporizationEvent): void {
  let heldTokenAddress = TokenMarketIdReverseMap.load(event.params.heldMarket.toString())!.token
  let heldToken = Token.load(heldTokenAddress) as Token

  let owedTokenAddress = TokenMarketIdReverseMap.load(event.params.owedMarket.toString())!.token
  let owedToken = Token.load(owedTokenAddress) as Token

  const balanceUpdateOne = new BalanceUpdate(
    event.params.vaporAccountOwner,
    event.params.vaporAccountNumber,
    owedToken,
    event.params.vaporOwedUpdate.newPar.value,
    event.params.vaporOwedUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateOne, event)

  const balanceUpdateTwo = new BalanceUpdate(
    event.params.solidAccountOwner,
    event.params.solidAccountNumber,
    heldToken,
    event.params.solidHeldUpdate.newPar.value,
    event.params.solidHeldUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateTwo, event)

  const balanceUpdateThree = new BalanceUpdate(
    event.params.solidAccountOwner,
    event.params.solidAccountNumber,
    owedToken,
    event.params.solidOwedUpdate.newPar.value,
    event.params.solidOwedUpdate.newPar.sign
  )
  handleDolomiteMarginBalanceUpdateForAccount(balanceUpdateThree, event)
}

export function handleSetExpiry(event: ExpirySetEvent): void {
  const tokenAddress = TokenMarketIdReverseMap.load(event.params.marketId.toString())!.token
  const token = Token.load(tokenAddress) as Token

  const marginAccount = getOrCreateMarginAccount(event.params.owner, event.params.number, event.block)
  if (event.params.time.equals(ZERO_BI)) {
    // remove the market ID
    let index = marginAccount.expirationTokens.indexOf(token.id)
    if (index != -1) {
      let copy = marginAccount.expirationTokens
      copy.splice(index, 1)
      // NOTE we must use the copy here because the return value of #splice isn't the new array. Rather, it returns the
      // DELETED element only
      marginAccount.expirationTokens = copy
    }
    marginAccount.hasExpiration = marginAccount.expirationTokens.length > 0
  } else {
    // add the market ID, if necessary
    let index = marginAccount.expirationTokens.indexOf(token.id)
    if (index == -1) {
      marginAccount.expirationTokens = marginAccount.expirationTokens.concat([token.id])
    }
    marginAccount.hasExpiration = true
  }
  marginAccount.save()

  const transaction = getOrCreateTransaction(event)

  const tokenValue = getOrCreateTokenValue(marginAccount, token, transaction)
  if (event.params.time.equals(ZERO_BI)) {
    tokenValue.expirationTimestamp = null
    tokenValue.expiryAddress = null
  } else {
    tokenValue.expirationTimestamp = event.params.time
    tokenValue.expiryAddress = event.address
  }
  tokenValue.save()
}
