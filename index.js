var instance_skel = require('../../instance_skel');
var tcp = require('../../tcp');
var debug;
var log;

function instance(system, id, config) {
		var self = this;

		// super-constructor
		instance_skel.apply(this, arguments);
		self.actions(); // export actions
		return self;
}

instance.prototype.init = function () {
		var self = this;

		debug = self.debug;
		log = self.log;

		self.status(self.STATUS_UNKNOWN);

		if (self.config.host !== undefined) {
				self.tcp = new tcp(self.config.host, 43680);

				self.tcp.on('status_change', function (status, message) {
						self.status(status, message);
				});

				self.tcp.on('error', function () {
						// Ignore
				});
		}
};

instance.prototype.updateConfig = function (config) {
		var self = this;
		self.config = config;

		if (self.tcp !== undefined) {
				self.tcp.destroy();
				delete self.tcp;
		}

		if (self.config.host !== undefined) {
				self.tcp = new tcp(self.config.host, 43680);

				self.tcp.on('status_change', function (status, message) {
						self.status(status, message);
				});

				self.tcp.on('error', function (message) {
						// ignore for now
				});
		}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
		var self = this;
		return [
				{
						type: 'text',
						id: 'info',
						width: 12,
						label: 'Information',
						value: 'This module is for Barco HDX'
				},
				{
						type: 'textinput',
						id: 'host',
						label: 'Target IP',
						width: 6,
						default: '192.168.0.100',
						regex: self.REGEX_IP
				}
		];
};

// When module gets deleted
instance.prototype.destroy = function () {
		var self = this;

		if (self.tcp !== undefined) {
				self.tcp.destroy();
		}
		debug("destroy", self.id);
};

instance.prototype.actions = function (system) {
	var self = this;

	var actions = {
			'lamp': {
					label: 'Lamp control',
					options: [{
						type: 'dropdown',
						label: 'on/off',
						id: 'lamp',
						default: 'lamp_on',
						choices: [{ label: 'lamp on', id: 'lamp_on' }, { label: 'lamp off', id: 'lamp_off' }]
					}]
			},
			'shutter': {
					label: 'Shutter',
					options: [{
						type: 'dropdown',
						label: 'open/close',
						id: 'shutter',
						default: 'shutter_close',
						choices: [{ label: 'shutter close', id: 'shutter_close' }, { label: 'shutter open', id: 'shutter_open' }]
					}]
			},
			'lensShift': {
					label: 'Shift the lens',
					options: [{
						type: 'dropdown',
						id: 'side',
						label: 'Shift',
						choices: [{ label: 'Up', id: '0x00'}, { label: 'Down', id: '0x01'}, { label: 'Left', id: '0x02'}, { label: 'Right', id: '0x03'}],
						default: '0x00'
					}]
			},
			'lensZoom': {
				label: 'Zoom the lens',
				options: [{
					type: 'dropdown',
					id: 'zoom',
					label: 'zoom',
					choices: [{ label: 'Zoom in', id: '0x00'},{ label: 'Zoom out', id: '0x01'}],
					default: '0x00'
				}]
			},
			'lensFocus': {
				label: 'Focus the lens',
				options: [{
					type: 'dropdown',
					id: 'focus',
					label: 'focus',
					choices: [{ label: 'Near', id: '0x00'},{ label: 'Far', id: '0x01'}],
					default: '0x00'
				}]
			}
	};

	self.setActions(actions);
};

instance.prototype.action = function (action) {
		var self = this;
		var id = action.action;
		var opt = action.options;
		var cmd;

		getCommandValue = function(command, parameter) {
				let checksum = 5;
				let pBuffer  = Buffer.from(parameter);

				// Calculate the checksum value.
				command.forEach(function(item) {
						checksum += item;
				});

				pBuffer.forEach(function(item) {
						checksum += item;
				});

				checksum = checksum % 256;

				// Build the value to be sent. 0x00,0x03,0x02 is an answer request it's optional
				return Buffer.concat([
					Buffer.from([0xFE, 0x0, 0x0, 0x03, 0x02]),
					command,
					pBuffer,
					Buffer.from([0x0]),
					Buffer.from([checksum]),
					Buffer.from([0xFF])]);
		};

		switch (id) {
				case 'lamp':
					if (opt.lamp === 'lamp_on') {
						cmd = getCommandValue(Buffer.from([0x76,0x1a]), '1').toString('hex');
					} else if (opt.lamp === 'lamp_off') {
						cmd = getCommandValue(Buffer.from([0x76,0x1a]), '0').toString('hex');
					}
					break;

				case 'shutter':
					if (opt.lamp === 'shutter_open') {
						cmd = getCommandValue(Buffer.from([0x22,0x42]), '0');
					} else if (opt.lamp === 'shutter_close') {
						cmd = getCommandValue(Buffer.from([0x23,0x42]), '0').toString('hex');
					}
					break;

				case 'lensShift':
					cmd = getCommandValue(Buffer.from([0xf4, 0x81]), opt.side).toString('hex');
					break;

				case 'lensZoom':
					cmd = getCommandValue(Buffer.from([0xf4, 0x82]), opt.zoom).toString('hex');
					break;


				case 'lensFocus':
					cmd = getCommandValue(Buffer.from([0xf4, 0x83]), opt.focus).toString('hex');
					break;

		}

		if (cmd !== undefined) {
				if (self.tcp !== undefined) {
						debug('sending ', cmd, "to", self.tcp.host);
						self.tcp.send(cmd);
				}
		}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
