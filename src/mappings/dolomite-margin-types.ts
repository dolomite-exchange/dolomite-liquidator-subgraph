import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts'
import { convertTokenToDecimal, ZERO_BI } from './helpers'
import { Token } from '../types/schema'

export class BalanceUpdate {

  accountOwner: Address
  accountNumber: BigInt
  market: BigInt
  valuePar: BigDecimal

  constructor(
    accountOwner: Address,
    accountNumber: BigInt,
    token: Token,
    valuePar: BigInt,
    sign: boolean
  ) {
    this.accountOwner = accountOwner
    this.accountNumber = accountNumber
    this.market = token.marketId
    if (sign) {
      this.valuePar = convertTokenToDecimal(valuePar, token.decimals)
    } else {
      this.valuePar = convertTokenToDecimal(ZERO_BI.minus(valuePar), token.decimals)
    }
  }

}
