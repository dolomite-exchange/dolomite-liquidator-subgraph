/* eslint-disable prefer-const */
import { Address, BigDecimal, BigInt, Bytes, dataSource, ethereum } from '@graphprotocol/graph-ts'
import { ERC20 } from '../types/MarginTrade/ERC20'
import { ERC20SymbolBytes } from '../types/MarginTrade/ERC20SymbolBytes'
import { ERC20NameBytes } from '../types/MarginTrade/ERC20NameBytes'
import { ValueStruct } from './dydx_types'
import { TypedMap } from '@graphprotocol/graph-ts'
import { DyDxSoloMargin, Transaction } from '../types/schema'
import { DyDx } from '../types/MarginTrade/DyDx'

const MAINNET_NETWORK = 'mainnet'
const MUMBAI_NETWORK = 'mumbai'

export const NETWORK = dataSource.network()

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000'.toLowerCase()

const FACTORY_ADDRESSES: TypedMap<string, string> = new TypedMap<string, string>()
FACTORY_ADDRESSES.set(MUMBAI_NETWORK, '0xaE3a05f33E2f358eB98c24F59f0E13f92D869160'.toLowerCase())
export const FACTORY_ADDRESS = FACTORY_ADDRESSES.get(NETWORK) as string

const SOLO_MARGIN_ADDRESSES: TypedMap<string, string> = new TypedMap<string, string>()
SOLO_MARGIN_ADDRESSES.set(MUMBAI_NETWORK, '0x2099Ec20e4CDE118ceCa32D0357F3a7713514960'.toLowerCase())
export const SOLO_MARGIN_ADDRESS = SOLO_MARGIN_ADDRESSES.get(NETWORK) as string

const DAI_ADDRESSES: TypedMap<string, string> = new TypedMap<string, string>()
DAI_ADDRESSES.set(MAINNET_NETWORK, '0x6b175474e89094c44da98b954eedeac495271d0f'.toLowerCase())
DAI_ADDRESSES.set(MUMBAI_NETWORK, '0x8ac8ae0a208bef466512cd26142ac5a3ddb5b99e'.toLowerCase())
export const DAI_ADDRESS = DAI_ADDRESSES.get(NETWORK) as string

const USDC_ADDRESSES: TypedMap<string, string> = new TypedMap<string, string>()
USDC_ADDRESSES.set(MAINNET_NETWORK, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'.toLowerCase())
USDC_ADDRESSES.set(MUMBAI_NETWORK, '0xade692c9b8c36e6b04bcfd01f0e91c7ebee0a160'.toLowerCase())
export const USDC_ADDRESS = USDC_ADDRESSES.get(NETWORK) as string

const WETH_ADDRESSES: TypedMap<string, string> = new TypedMap<string, string>()
WETH_ADDRESSES.set(MAINNET_NETWORK, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'.toLowerCase())
WETH_ADDRESSES.set(MUMBAI_NETWORK, '0xa38ef095d071ebbafea5e7d1ce02be79fc376793'.toLowerCase())
export const WETH_ADDRESS = WETH_ADDRESSES.get(NETWORK) as string

const USDC_WETH_PAIRS: TypedMap<string, string> = new TypedMap<string, string>()
USDC_WETH_PAIRS.set(MUMBAI_NETWORK, '0x90Bb045AEFbAf3555F44B3CAAa9ACdBfb6F04Dc5'.toLowerCase())
export const USDC_WETH_PAIR = USDC_WETH_PAIRS.get(NETWORK) as string

const DAI_WETH_PAIRS: TypedMap<string, string> = new TypedMap<string, string>()
DAI_WETH_PAIRS.set(MUMBAI_NETWORK, '0xB7740C2F4D70Ca88B09CB717Ea68Ec03206A1ec4'.toLowerCase())
export const DAI_WETH_PAIR = DAI_WETH_PAIRS.get(NETWORK) as string

const USDT_WETH_PAIRS: TypedMap<string, string> = new TypedMap<string, string>()
USDT_WETH_PAIRS.set(MUMBAI_NETWORK, ''.toLowerCase())
export const USDT_WETH_PAIR = USDT_WETH_PAIRS.get(NETWORK) as string

const WHITELISTS: TypedMap<string, string[]> = new TypedMap<string, string[]>()
WHITELISTS.set(MAINNET_NETWORK, [
  // token where amounts should contribute to tracked volume and liquidity
  WETH_ADDRESSES.get(MAINNET_NETWORK) as string,
  USDC_ADDRESSES.get(MAINNET_NETWORK) as string,
  DAI_ADDRESSES.get(MAINNET_NETWORK) as string,
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
  '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
  '0x86fadb80d8d2cff3c3680819e4da99c10232ba0f', // EBASE
  '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // sUSD
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
  '0xc00e94cb662c3520282e6f5717214004a7f26888', // COMP
  '0x514910771af9ca656af840dff83e8264ecf986ca', //LINK
  '0x960b236a07cf122663c4303350609a66a7b288c0', //ANT
  '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', //SNX
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', //YFI
  '0xdf5e0e81dff6faf3a7e52ba697820c5e32d806a8' // yCurv
])
WHITELISTS.set(MUMBAI_NETWORK, [
  WETH_ADDRESSES.get(MUMBAI_NETWORK) as string, // WETH
  USDC_ADDRESSES.get(MUMBAI_NETWORK) as string, // USDC
  DAI_ADDRESSES.get(MUMBAI_NETWORK) as string, // DAI
  '0xbee8c17b7449fa0cc54d857d774ce523a7a35d00'.toLowerCase() // WMATIC
])
export const WHITELIST = WHITELISTS.get(NETWORK) as string[]

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

export function convertStructToDecimal(struct: ValueStruct, exchangeDecimals: BigInt): BigDecimal {
  let value = struct.sign ? struct.value : struct.value.neg()
  if (exchangeDecimals.equals(ZERO_BI)) {
    return value.toBigDecimal()
  } else {
    return value.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals))
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

export function getOrCreateSoloMarginForDyDxCall(): DyDxSoloMargin {
  let soloMargin = DyDxSoloMargin.load(SOLO_MARGIN_ADDRESS)
  if (soloMargin === null) {
    soloMargin = new DyDxSoloMargin(SOLO_MARGIN_ADDRESS)

    soloMargin.numberOfMarkets = 0

    let dydxProtocol = DyDx.bind(Address.fromString(SOLO_MARGIN_ADDRESS))
    let riskParams = dydxProtocol.getRiskParams()

    let liquidationRatioBD = new BigDecimal(riskParams.marginRatio.value)
    let liquidationRewardBD = new BigDecimal(riskParams.liquidationSpread.value)
    let earningsRateBD = new BigDecimal(riskParams.earningsRate.value)
    let minBorrowedValueBD = new BigDecimal(riskParams.minBorrowedValue.value)

    soloMargin.liquidationRatio = liquidationRatioBD.div(BD_ONE_ETH).plus(ONE_BD)
    soloMargin.liquidationReward = liquidationRewardBD.div(BD_ONE_ETH).plus(ONE_BD)
    soloMargin.earningsRate = earningsRateBD.div(BD_ONE_ETH)
    soloMargin.minBorrowedValue = minBorrowedValueBD.div(BD_ONE_ETH).div(BD_ONE_ETH)
  }

  return soloMargin as DyDxSoloMargin
}
