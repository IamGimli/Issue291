const CommandHandler = require('./commandHandler.js');
/**
 * @module SdtdCommandsHook
 * @description a Sails project hook. Ingame command handler for Sdtd
 * @param {*} sails Global sails instance
 */

/**
 * @module SdtdCommands
 * @description Command guide for users
 */

module.exports = function sdtdCommands(sails) {

  /**
   * @var {Map} commandInfoMap Keeps track of servers with commands activated
   * @private
   */

  let commandInfoMap = new Map();

  return {

    /**
     * @memberof module:SdtdCommandsHook
     * @method
     * @name initialize
     * @description Initializes the ingame command listener(s)
     */
    initialize: async function (cb) {
      sails.on('hook:orm:loaded', async function () {
        sails.on('hook:sdtdlogs:loaded', async function () {
          try {
            let enabledServers = await SdtdConfig.find({
              commandsEnabled: true
            });
            enabledServers.forEach(serverConfig => {
              start(serverConfig.server);
            });
            sails.log.info(`HOOK SdtdCommands - initialized ${enabledServers.length} ingame command listeners`);
          } catch (error) {
            sails.log.error(`HOOK SdtdCommands:initialize - ${error}`);
          }
          cb();
        });
      });
    },

    /**
     * @memberof module:SdtdCommandsHook
     * @method
     * @name start
     * @description Starts the ingame command listener(s)
     */

    start: start,

    /**
     * @memberof module:SdtdCommandsHook
     * @method
     * @name stop
     * @description Stops the ingame command listener(s)
     */

    stop: stop,

    /**
     * @memberof module:SdtdCommandsHook
     * @method
     * @name getStatus
     * @description Get the commands status for a server
     * @returns {boolean}
     */

    getStatus: function (serverId) {
      return commandInfoMap.has(serverId);
    },

    /**
     * @memberof module:SdtdCommandsHook
     * @method
     * @name updateConfig
     * @description Updates command config for a server and reload the hook
     */

    updateConfig: async function (serverId, newConfig) {
      try {
        sails.log.debug(`HOOK sdtdCommands:updateConfig - Updating commands config for server ${serverId}`);

        if (_.isUndefined(newConfig.commandPrefix) || _.isUndefined(newConfig.commandsEnabled)) {
          throw new Error('Missing value(s) for command config. Please check input');
        }

        await SdtdConfig.update({
          server: serverId
        }, {
          commandsEnabled: newConfig.commandsEnabled,
          commandPrefix: newConfig.commandPrefix
        });

        if (newConfig.commandsEnabled) {
          this.stop(serverId);
          this.start(serverId);
        } else {
          this.stop(serverId);
        }

      } catch (error) {
        sails.log.error(`HOOK SdtdCommands:updateConfig - ${error}`);
        throw error;
      }
    }

  };

  async function start(serverId) {

    try {
      sails.log.silly(`HOOK sdtdCommands:start - Starting commands for server ${serverId}`);
      let serverConfig = await SdtdConfig.findOne({
        server: serverId
      });
      if (serverConfig.commandsEnabled) {
        let serverLoggingObj = sails.hooks.sdtdlogs.getLoggingObject(String(serverId));
        let commandHandler = new CommandHandler(serverId, serverLoggingObj, serverConfig);
        commandInfoMap.set(String(serverId), commandHandler);
        return true;
      }
    } catch (error) {
      sails.log.error(`HOOK SdtdCommands:start - ${error}`);
      throw error;
    }
  }

  async function stop(serverId) {
    try {
      sails.log.silly(`HOOK sdtdCommands:stop - Stopping commands for server ${serverId}`);
      let commandHandler = commandInfoMap.get(String(serverId));
      if (!_.isUndefined(commandHandler)) {
        commandHandler.stop();
        return commandInfoMap.delete(String(serverId));
      }
      return;
    } catch (error) {
      sails.log.error(`HOOK SdtdCommands:stop - ${error}`);
      throw error;
    }
  }
};