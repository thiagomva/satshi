import { AppConfig } from 'blockstack'

export const appConfig = new AppConfig(['store_write', 'publish_data'])

export const stream_server_url = process.env.REACT_APP_STREAM_SERVER_URL
export const server_url = process.env.REACT_APP_SERVER_API
export const open_node_url = process.env.REACT_APP_OPEN_NODE_URL
export const invoice_network = process.env.REACT_APP_INVOICE_NETWORK