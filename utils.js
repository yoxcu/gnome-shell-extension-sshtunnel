const Gettext        = imports.gettext
const Gio            = imports.gi.Gio
const Config         = imports.misc.config
const ExtensionUtils = imports.misc.extensionUtils
const Me             = ExtensionUtils.getCurrentExtension()

function Tunnel(hostname,forwards,reverses,options,user,id=null,enabled=true){
    this.user=user
    this.hostname=hostname;
    this.forwards=forwards;
    this.reverses=reverses;
    this.options=options;
    this.id=id;
    this.enabled=enabled;
}

function safeSpawn(cmd) {
  try {
    return GLib.spawn_command_line_sync(cmd)
  } catch (e) {
    return [false, Bytes.fromString(''), null, null]
  }
}

function command(args, pipe) {
  const cmd = [].concat(args).filter(item => !!item).join(' ')
  const str = pipe ? [cmd, pipe].join(' | ') : cmd

  return safeSpawn(`sh -c "${str}"`)
}

function systemctl(type, args, pipe) {
  const cmd = [`systemctl --${type}`].concat(args)
  return command(cmd, pipe)
}




function getSettings(schema) {
  schema = schema || Me.metadata['settings-schema']

  let gioSSS       = Gio.SettingsSchemaSource
  let schemaDir    = Me.dir.get_child('schemas')
  let schemaSource = gioSSS.get_default()

  if (schemaDir.query_exists(null)) {
    schemaDir    = schemaDir.get_path()
    schemaSource = gioSSS.new_from_directory(schemaDir, schemaSource, false)
  }

  let schemaObj = schemaSource.lookup(schema, true)

  if (!schemaObj) {
    let metaId  = Me.metadata.uuid
    let message = `Schema ${schema} could not be found for extension ${metaId}.`

    throw new Error(`${message} Please check your installation.`)
  }

  return new Gio.Settings({ settings_schema: schemaObj })
}
