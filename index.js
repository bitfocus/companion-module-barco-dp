const { InstanceBase, runEntrypoint, TCPHelper, InstanceStatus } = require('@companion-module/base')

class BarcoDPInstance extends InstanceBase {
  constructor(internal) {
    super(internal)
    this.tcp = null
  }

  async init(config) {
    this.config = config
    this.updateStatus(InstanceStatus.Connecting)
    this.initTCP()
    this.initActions()
  }

  async destroy() {
    if (this.tcp) {
      this.tcp.destroy()
      this.tcp = null
    }
  }

  async configUpdated(config) {
    this.config = config
    this.initTCP()
  }

  getConfigFields() {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Target IP',
        default: '192.168.0.100',
        width: 6,
      },
      {
        type: 'textinput',
        id: 'port',
        label: 'Port',
        default: '43728',
        width: 6,
        tooltip: 'Port 43728 for Series 2',
      },
    ]
  }

  initTCP() {
    if (this.tcp) {
      this.tcp.destroy()
      this.tcp = null
    }

    if (this.config.host) {
      this.tcp = new TCPHelper(this.config.host, parseInt(this.config.port))

      this.tcp.on('status_change', (status, message) => {
        this.updateStatus(status, message)
      })

      this.tcp.on('error', (err) => {
        this.log('error', `TCP Error: ${err.message}`)
      })
    }
  }

  initActions() {
    this.setActionDefinitions({
      lamp: {
        name: 'Lamp control',
        options: [
          {
            type: 'dropdown',
            label: 'On/Off',
            id: 'lamp',
            default: 'lamp_on',
            choices: [
              { id: 'lamp_on', label: 'Lamp On' },
              { id: 'lamp_off', label: 'Lamp Off' },
            ],
          },
        ],
        callback: async (event) => {
          let cmd
          if (event.options.lamp === 'lamp_on') {
            cmd = this.getCommandValue(Buffer.from([0x00, 0x03, 0x02, 0x76, 0x1a]), '1')
          } else {
            cmd = this.getCommandValue(Buffer.from([0x00, 0x03, 0x02, 0x76, 0x1a]), '0')
          }
          this.sendCommand(cmd)
        },
      },

      shutter: {
        name: 'Shutter',
        options: [
          {
            type: 'dropdown',
            label: 'Open/Close',
            id: 'shutter',
            default: 'shutter_close',
            choices: [
              { id: 'shutter_close', label: 'Close' },
              { id: 'shutter_open', label: 'Open' },
            ],
          },
        ],
        callback: async (event) => {
          const cmd =
            event.options.shutter === 'shutter_open'
              ? Buffer.from([0xfe, 0x00, 0x22, 0x42, 0x00, 0x64, 0xff])
              : Buffer.from([0xfe, 0x00, 0x23, 0x42, 0x00, 0x65, 0xff])
          this.sendCommand(cmd)
        },
      },

      lensShift: {
        name: 'Lens Shift',
        options: [
          {
            type: 'dropdown',
            id: 'side',
            label: 'Shift Direction',
            choices: [
              { label: 'Up', id: '0' },
              { label: 'Down', id: '1' },
              { label: 'Left', id: '2' },
              { label: 'Right', id: '3' },
            ],
            default: '0',
          },
        ],
        callback: async (event) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x81]), event.options.side)
          this.sendCommand(cmd)
        },
      },

      lensZoom: {
        name: 'Lens Zoom',
        options: [
          {
            type: 'dropdown',
            id: 'zoom',
            label: 'Zoom',
            choices: [
              { label: 'Zoom In', id: '0' },
              { label: 'Zoom Out', id: '1' },
            ],
            default: '0',
          },
        ],
        callback: async (event) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x82]), event.options.zoom)
          this.sendCommand(cmd)
        },
      },

      lensFocus: {
        name: 'Lens Focus',
        options: [
          {
            type: 'dropdown',
            id: 'focus',
            label: 'Focus',
            choices: [
              { label: 'Near', id: '0' },
              { label: 'Far', id: '1' },
            ],
            default: '0',
          },
        ],
        callback: async (event) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x83]), event.options.focus)
          this.sendCommand(cmd)
        },
      },

      macro: {
        name: 'Execute Macro',
        options: [
          {
            type: 'textinput',
            id: 'macro',
            label: 'Macro Name',
          },
        ],
        callback: async (event) => {
          const cmd = this.getCommandValue(Buffer.concat([Buffer.from([0xe8, 0x81]), Buffer.from(event.options.macro)]), null)
          this.sendCommand(cmd)
        },
      },
    })
  }

  getCommandValue(command, parameter) {
    let checksum = 0
    command.forEach((b) => (checksum += b))

    if (parameter !== null) {
      const pBuffer = Buffer.from([parseInt(parameter)])
      pBuffer.forEach((b) => (checksum += b))
      checksum = checksum % 256

      return Buffer.concat([Buffer.from([0xfe, 0x00]), command, pBuffer, Buffer.from([checksum, 0xff])])
    } else {
      checksum = checksum % 256
      return Buffer.concat([Buffer.from([0xfe, 0x00]), command, Buffer.from([0x00, checksum, 0xff])])
    }
  }

  sendCommand(cmd) {
    if (this.tcp && cmd) {
      this.log('debug', `Sending command: ${cmd.toString('hex')}`)
      this.tcp.send(cmd)
    }
  }
}

runEntrypoint(BarcoDPInstance)