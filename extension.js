/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const Bytes  = imports.byteArray
const GLib   = imports.gi.GLib
const Config = imports.misc.config

const GETTEXT_DOMAIN = 'SSHTunnel';

const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const _ = ExtensionUtils.gettext;

const Me                = imports.misc.extensionUtils.getCurrentExtension()
const Utils             = Me.imports.utils

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        this.settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
        //this._settings.connect('changed', () => this.update())

        super._init(0.0, _('SSH Tunnel Indicator'));
        this.icon=new St.Icon({
            icon_name: 'content-loading-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);

        let turn_on = new PopupMenu.PopupMenuItem(_('Turn Service On'));
        turn_on.connect('activate', () => {
            this.enable_service()
            Main.notify(_('SSH Tunnel Service enabled'));
        });
        this.menu.addMenuItem(turn_on);
        
        let turn_off = new PopupMenu.PopupMenuItem(_('Turn Service Off'));
        turn_off.connect('activate', () => {
            this.disable_service()
            Main.notify(_('SSH Tunnel Service disabled'))
        });
        this.menu.addMenuItem(turn_off);

        this.initializeTimer();
    }

    initializeTimer() {
        // used to query sensors and update display
        let update_time = 1;
        this.refreshTimeoutId = Mainloop.timeout_add_seconds(update_time, (self) => {
            // only update menu if we have hot sensors
            this.update();

            // keep the timer running
            return true;
        });
    }

    destroyTimer() {
        // invalidate and reinitialize timer
        if (this.refreshTimeoutId != null) {
            Mainloop.source_remove(this.refreshTimeoutId);
            this.refreshTimeoutId = null;
        }
    }

    update(){
        this.menu.removeAll() 

        const entries     = this.settings.get_strv('tunnels');
        const showAdd     = this.settings.get_boolean('show-add');
        const showRestart = this.settings.get_boolean('show-restart');
        //entries.push("asdf");
        //Main.notify(JSON.stringify(entries));
        //const tunnel    = entries.map(data => JSON.parse(data)) 

        switch(getServicesState("system",["autossh@morty"])["autossh@morty"]){
            case "active":
                this.show_active();
                break;
            case "activating":
                this.show_activating();
                break;
            default:
                this.show_inactive();
        }

        if (showAdd) {
            const settings = new PopupMenu.PopupMenuItem(_('Add Tunnel'))
            settings.connect('activate', () =>{
                ExtensionUtils.openPrefs();
            })
            this.menu.addMenuItem(settings)
        }
    }

    enable_service(){
        runServiceAction("enable", "system", "autossh@morty");
    }

    disable_service(){
        runServiceAction("disable", "system", "autossh@morty");
    }

    show_active(){
        this.remove_child(this.icon);
        this.icon=new St.Icon({
            icon_name: 'emblem-ok-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }

    show_activating(){
        this.remove_child(this.icon);
        this.icon=new St.Icon({
            icon_name: 'content-loading-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }
 
    show_inactive(){
        this.remove_child(this.icon);
        this.icon=new St.Icon({
            icon_name: 'computer-fail-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }   

    destroy() {
        this.destroyTimer();
        super.destroy();
    }
});

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

function getServicesState(type, services) {
  const res = systemctl(type, ['is-failed', ...services])
  const out = Bytes.toString(res[1])
  return out.split('\n').reduce(
   (all, value, idx) => ({ ...all, [services[idx]]: value }), {}
  )
}

function runServiceAction(action, type, service) {
  let cmd = `systemctl ${action} ${service} --${type} --now`
  GLib.spawn_command_line_async(`sh -c "${cmd}; exit"`)
}

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
