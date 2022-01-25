/* eslint-disable prefer-const */
import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { ERC20 } from '../types/MarginTrade/ERC20'
import { ERC20SymbolBytes } from '../types/MarginTrade/ERC20SymbolBytes'
import { ERC20NameBytes } from '../types/MarginTrade/ERC20NameBytes'
import { DolomiteMargin, Transaction } from '../types/schema'
import { DolomiteMargin as DolomiteMarginProtocol } from '../types/MarginTrade/DolomiteMargin'
import { DOLOMITE_MARGIN_ADDRESS } from './generated/constants'

export let ZERO_BYTES = new Bytes(0)
export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let BI_10 = BigInt.fromI32(10)
export let BI_18 = BigInt.fromI32(18)
export let BI_ONE_ETH = BI_10.pow(18)
export let BD_ONE_ETH = new BigDecimal(BI_ONE_ETH)
export let SECONDS_IN_YEAR = BigInt.fromI32(31536000)

export function bigDecimalAbs(bd: BigDecimal): BigDecimal {
  if (bd.lt(ZERO_BD)) {
    return ZERO_BD.minus(bd)
  } else {
    return bd
  }
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString('1')
  for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
    bd = bd.times(BigDecimal.fromString('10'))
  }
  return bd
}

export function bigDecimalExp18(): BigDecimal {
  return BigDecimal.fromString('1000000000000000000')
}

export function convertEthToDecimal(eth: BigInt): BigDecimal {
  return eth.toBigDecimal().div(exponentToBigDecimal(BigInt.fromI32(18)))
}

export function convertTokenToDecimal(tokenAmount: BigInt, exchangeDecimals: BigInt): BigDecimal {
  if (exchangeDecimals.equals(ZERO_BI)) {
    return tokenAmount.toBigDecimal()
  } else {
    return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
  }
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001'
}

export function fetchTokenSymbol(tokenAddress: Address): string {
  // hard coded overrides
  if (tokenAddress.toHexString() == '0xe0b7927c4af23765cb51314a0e0521a9645f0e2a') {
    return 'DGD'
  }
  if (tokenAddress.toHexString() == '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9') {
    return 'AAVE'
  }

  let contract = ERC20.bind(tokenAddress)
  let contractSymbolBytes = ERC20SymbolBytes.bind(tokenAddress)

  // try types string and bytes32 for symbol
  let symbolValue = 'unknown'
  let symbolResult = contract.try_symbol()
  if (symbolResult.reverted) {
    let symbolResultBytes = contractSymbolBytes.try_symbol()
    if (!symbolResultBytes.reverted) {
      // for broken pairs that have no symbol function exposed
      if (!isNullEthValue(symbolResultBytes.value.toHexString())) {
        log.info('Getting raw symbol for {}', [tokenAddress.toHexString()])
        symbolValue = symbolResultBytes.value.toString()
      }
    }
  } else {
    symbolValue = symbolResult.value
  }

  return symbolValue
}

export function fetchTokenName(tokenAddress: Address): string {
  // hard coded overrides
  if (tokenAddress.toHexString() == '0xe0b7927c4af23765cb51314a0e0521a9645f0e2a') {
    return 'DGD'
  }
  if (tokenAddress.toHexString() == '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9') {
    return 'Aave Token'
  }

  let contract = ERC20.bind(tokenAddress)
  let contractNameBytes = ERC20NameBytes.bind(tokenAddress)

  // try types string and bytes32 for name
  let nameValue = 'unknown'
  let nameResult = contract.try_name()
  if (nameResult.reverted) {
    let nameResultBytes = contractNameBytes.try_name()
    if (!nameResultBytes.reverted) {
      // for broken exchanges that have no name function exposed
      if (!isNullEthValue(nameResultBytes.value.toHexString())) {
        log.info('Getting raw name for {}', [tokenAddress.toHexString()])
        nameValue = nameResultBytes.value.toString()
      }
    }
  } else {
    nameValue = nameResult.value
  }

  return nameValue
}

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  // hardcode overrides
  const aaveToken = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'
  if (tokenAddress.toHexString() == aaveToken) {
    return BigInt.fromI32(18)
  }

  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    return BigInt.fromI32(decimalResult.value)
  } else {
    return BigInt.fromI32(0)
  }
}

export function getOrCreateTransaction(event: ethereum.Event): Transaction {
  let transactionID = event.transaction.hash.toHexString()
  let transaction = Transaction.load(transactionID)
  if (transaction === null) {
    transaction = new Transaction(transactionID)
    transaction.blockNumber = event.block.number
    transaction.timestamp = event.block.timestamp
    transaction.save()
  }

  return transaction as Transaction
}

export function getOrCreateDolomiteMarginForCall(): DolomiteMargin {
  let dolomiteMargin = DolomiteMargin.load(DOLOMITE_MARGIN_ADDRESS)
  if (dolomiteMargin === null) {
    dolomiteMargin = new DolomiteMargin(DOLOMITE_MARGIN_ADDRESS)

    dolomiteMargin.numberOfMarkets = 0

    let dolomiteMarginProtocol = DolomiteMarginProtocol.bind(Address.fromString(DOLOMITE_MARGIN_ADDRESS))
    let riskParams = dolomiteMarginProtocol.getRiskParams()

    let liquidationRatioBD = new BigDecimal(riskParams.marginRatio.value)
    let liquidationRewardBD = new BigDecimal(riskParams.liquidationSpread.value)
    let earningsRateBD = new BigDecimal(riskParams.earningsRate.value)
    let minBorrowedValueBD = new BigDecimal(riskParams.minBorrowedValue.value)

    dolomiteMargin.liquidationRatio = liquidationRatioBD.div(BD_ONE_ETH).plus(ONE_BD)
    dolomiteMargin.liquidationReward = liquidationRewardBD.div(BD_ONE_ETH).plus(ONE_BD)
    dolomiteMargin.earningsRate = earningsRateBD.div(BD_ONE_ETH)
    dolomiteMargin.minBorrowedValue = minBorrowedValueBD.div(BD_ONE_ETH).div(BD_ONE_ETH)
  }

  return dolomiteMargin as DolomiteMargin
}
