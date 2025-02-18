import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

import { URI_AVAILABLE } from '@anxolin/walletconnect-connector'
import { UnsupportedChainIdError, useWeb3React } from '@web3-react/core'
import ReactGA from 'react-ga'

import { injected, walletconnect } from '../../../connectors'
import { SUPPORTED_WALLETS } from '../../../constants'
import usePrevious from '../../../hooks/usePrevious'
import { useWalletModalOpen, useWalletModalToggle } from '../../../state/application/hooks'
import { useOrderPlacementState } from '../../../state/orderPlacement/hooks'
import { ExternalLink } from '../../../theme'
import { setupNetwork } from '../../../utils/setupNetwork'
import { AlertIcon } from '../../icons/AlertIcon'
import { Checkbox } from '../../pureStyledComponents/Checkbox'
import { NetworkError, useNetworkCheck } from '../../web3/Web3Status'
import Modal from '../common/Modal'
import { ModalTitle } from '../common/ModalTitle'
import Option from '../common/Option'
import PendingView from '../common/PendingView'
import { Content } from '../common/pureStyledComponents/Content'
import { IconWrapper } from '../common/pureStyledComponents/IconWrapper'
import { Text } from '../common/pureStyledComponents/Text'

const CheckboxWrapper = styled.div`
  align-items: baseline;
  display: flex;
  margin-bottom: 40px;
  margin-top: 12px;
`

const CheckboxText = styled.span`
  color: ${({ theme }) => theme.text1};
  font-size: 15px;
  font-weight: normal;
  line-height: 1.4;
  margin-left: 12px;

  a {
    color: ${({ theme }) => theme.text1};
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }
`

const Footer = styled.div`
  color: ${({ theme }) => theme.text1};
  font-size: 13px;
  font-weight: normal;
  line-height: 1.4;
  margin-left: 12px;
  text-align: center;

  a {
    color: ${({ theme }) => theme.text1};
    text-decoration: underline;

    &:hover {
      text-decoration: none;
    }
  }
`

const Options = styled.div`
  min-height: 130px;
`

const WALLET_VIEWS = {
  OPTIONS: 'options',
  OPTIONS_SECONDARY: 'options_secondary',
  ACCOUNT: 'account',
  PENDING: 'pending',
}

const WalletModal: React.FC = () => {
  const { account, activate, active, connector, error } = useWeb3React()
  const [walletView, setWalletView] = useState(WALLET_VIEWS.ACCOUNT)
  const [pendingWallet, setPendingWallet] = useState()
  const [pendingError, setPendingError] = useState<boolean>()
  const walletModalOpen = useWalletModalOpen()
  const toggleWalletModal = useWalletModalToggle()
  const previousAccount = usePrevious(account)
  const { errorWrongNetwork } = useNetworkCheck()
  const [termsAccepted, setTermsAccepted] = useState(false)
  const { chainId } = useOrderPlacementState()

  useEffect(() => {
    if (account && !previousAccount && walletModalOpen) {
      toggleWalletModal()
    }
  }, [account, previousAccount, toggleWalletModal, walletModalOpen])

  useEffect(() => {
    if (walletModalOpen) {
      setPendingError(false)
      setWalletView(WALLET_VIEWS.ACCOUNT)
    }
  }, [walletModalOpen])

  const [uri, setUri] = useState()
  useEffect(() => {
    const activateWC = (uri) => {
      setUri(uri)
    }
    walletconnect[chainId].on(URI_AVAILABLE, activateWC)
    return () => {
      walletconnect[chainId].off(URI_AVAILABLE, activateWC)
    }
  }, [chainId])

  const activePrevious = usePrevious(active)
  const connectorPrevious = usePrevious(connector)

  useEffect(() => {
    if (
      walletModalOpen &&
      ((active && !activePrevious) ||
        (connector &&
          connector !== connectorPrevious &&
          !error &&
          errorWrongNetwork === NetworkError.noError))
    ) {
      setWalletView(WALLET_VIEWS.ACCOUNT)
    }
  }, [
    setWalletView,
    active,
    error,
    connector,
    errorWrongNetwork,
    walletModalOpen,
    activePrevious,
    connectorPrevious,
  ])

  const tryActivation = async (connector) => {
    let name = ''
    Object.keys(SUPPORTED_WALLETS).map((key) => {
      if (connector === SUPPORTED_WALLETS[key].connector) {
        return (name = SUPPORTED_WALLETS[key].name)
      }
      return true
    })
    ReactGA.event({
      category: 'Wallet',
      action: 'Change Wallet',
      label: name,
    })

    try {
      // We check the metamask networkId
      // const provider = new Web3Provider(window.ethereum, 'any')
      // const { chainId: walletNetworkId } = await provider.getNetwork()
      // if (!Object.values(ChainId).includes(walletNetworkId)) {
      //   throw new UnsupportedChainIdError(
      //     walletNetworkId,
      //     Object.keys(ChainId).map((chainId) => Number(chainId)),
      //   )
      // }

      // if connector is an object with the set variable of [chainId], we know that its walletconnect object
      // otherwise, we will just use Metamask connector object
      if (connector[chainId]) {
        setPendingWallet(connector[chainId]) // set wallet for pending view
        setWalletView(WALLET_VIEWS.PENDING)

        await activate(connector[chainId], undefined, true)
      } else {
        setPendingWallet(connector) // set wallet for pending view
        setWalletView(WALLET_VIEWS.PENDING)
        const hasSetup = await setupNetwork(chainId)
        if (hasSetup) {
          await activate(connector, undefined, true)
        }
      }
    } catch (error) {
      if (error instanceof UnsupportedChainIdError) {
        activate(connector) // a little janky...can't use setError because the connector isn't set
      } else {
        setPendingError(true)
      }
    }
  }

  const getOptions = () => {
    const isMetamask = window.ethereum && window.ethereum.isMetaMask

    return Object.keys(SUPPORTED_WALLETS).map((key) => {
      const option = SUPPORTED_WALLETS[key]

      if (option.connector === injected) {
        if (!(window.web3 || window.ethereum)) {
          return null //dont want to return install twice
        } else if (option.name === 'MetaMask' && !isMetamask) {
          return null
        } else if (option.name === 'Injected' && isMetamask) {
          return null
        }
      }

      return (
        <Option
          disabled={!termsAccepted}
          icon={option.icon}
          key={key}
          onClick={() => {
            option.connector === connector
              ? setWalletView(WALLET_VIEWS.ACCOUNT)
              : !option.href && tryActivation(option.connector)
          }}
          text={option.name}
        />
      )
    })
  }

  const networkError = error instanceof UnsupportedChainIdError || errorWrongNetwork
  const viewAccountTransactions = account && walletView === WALLET_VIEWS.ACCOUNT
  const connectingToWallet = walletView === WALLET_VIEWS.PENDING
  const title =
    networkError === NetworkError.noChainMatch
      ? 'Wrong Network'
      : error && viewAccountTransactions
      ? ''
      : error
      ? 'Error connecting'
      : 'Connect to a wallet'
  const errorMessage =
    error instanceof UnsupportedChainIdError
      ? 'Please connect to the appropriate Ethereum network.'
      : errorWrongNetwork
      ? errorWrongNetwork
      : 'Error connecting. Try refreshing the page.'

  return (
    <Modal
      isOpen={walletModalOpen}
      onDismiss={toggleWalletModal}
      width={error || connectingToWallet ? 400 : undefined}
    >
      <ModalTitle onClose={toggleWalletModal} title={title} />
      <Content>
        {error && (
          <>
            <IconWrapper>
              <AlertIcon />
            </IconWrapper>
            <Text fontSize="18px" textAlign="center">
              {errorMessage}
            </Text>
          </>
        )}
        {!error && !connectingToWallet && (
          <>
            <Options>{getOptions()}</Options>
            <CheckboxWrapper onClick={() => setTermsAccepted(!termsAccepted)}>
              <Checkbox checked={termsAccepted} />
              <CheckboxText>
                I have read, understood and agree to the{' '}
                <NavLink target="_blank" to="/terms-and-conditions">
                  Terms &amp; Conditions
                </NavLink>
                .
              </CheckboxText>
            </CheckboxWrapper>
            <Footer>
              <span>Don&apos;t have wallet?</span>{' '}
              <ExternalLink href="https://metamask.io/download.html">Download here</ExternalLink>.
            </Footer>
          </>
        )}
        {!error && connectingToWallet && (
          <PendingView
            connector={pendingWallet}
            error={pendingError}
            setPendingError={setPendingError}
            tryActivation={tryActivation}
            uri={uri}
          />
        )}
      </Content>
    </Modal>
  )
}

export default WalletModal
