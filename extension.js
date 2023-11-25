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

const GETTEXT_DOMAIN = 'SSHTunnel';

import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Tunnel from './utils/tunnel.js';
import * as Service from './utils/service.js';


const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('SSH Tunnel Indicator'));
        this.extensionObject = Extension.lookupByUUID('sshtunnel@yoxcu.de');
        this.settings = this.extensionObject.getSettings('org.gnome.shell.extensions.sshtunnel');

        this.show_activating();
        this.newSettings = true;
        this.refresh();
        this.fillMenu();

        this.settings.connect('changed', () => {
            this.newSettings = true;
        })

        this.menu.connect('open-state-changed', () => {
            this.refresh();
        })
    }

    reloadSettings(){
        print("reloading Settings")
        this.tunnels = Tunnel.parseTunnels(this.settings.get_strv('tunnels'));
        this.serviceNames = [];
        this.tunnels.filter(tunnel => tunnel.enabled).forEach(tunnel => {
            this.serviceNames.push("sshtunnel."+tunnel.user+"@"+tunnel.id)
        })
        this.showSettingsButton = this.settings.get_boolean('show-settings');
        this.refreshTimeChanged();
        this.newSettings = false;
    }

    saveSettings(){
        const str = Tunnel.stringifyTunnels(this.tunnels);
        this.settings.set_strv("tunnels",str);
    }

    initializeTimer() {
        const refreshTime = this.settings.get_int('refresh-time');
        // used to query sensors and update display
        this.refreshTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,refreshTime, (self) => {
            // only update menu if we have hot sensors
            this.refresh();

            // keep the timer running
            return true;
        });
    }

    destroyTimer() {
        // invalidate and reinitialize timer
        if (this.refreshTimeoutId != null) {
            GLib.Source.remove(this.refreshTimeoutId);
            this.refreshTimeoutId = null;
        }
    }

    refreshTimeChanged() {
        this.destroyTimer();
        this.initializeTimer();
    }

    fillMenu(){
        print("filling Menu")
        this.menu.removeAll();

        this.tunnels.forEach(tunnel => {
            const toggle = new PopupMenu.PopupSwitchMenuItem(tunnel.hostname, tunnel.enabled);
            this.menu.addMenuItem(toggle);
            toggle.connect('toggled', () => {
                tunnel.enabled = toggle.state;
                Service.updateServiceStateAsync(tunnel);
                this.saveSettings();
            });
        });

        if (this.showSettingsButton) {
            if (this.tunnels.length > 0) {
                const separator = new PopupMenu.PopupSeparatorMenuItem();
                this.menu.addMenuItem(separator);
            }

            const settingsButton = new PopupMenu.PopupMenuItem(_('Settings'));
            settingsButton.connect('activate', () =>{
                this.extensionObject.openPreferences();
            })
            this.menu.addMenuItem(settingsButton);
        }

    }

    refresh(){
        print("refreshing")
        this.remove_child(this.icon);

        if (this.newSettings){
            this.reloadSettings();
        }

        this.serviceStates= Service.getServicesState(this.serviceNames);
        print(this.serviceStates)
        if (this.serviceStates.length <=0){
            this.show_empty();
        }else if (this.serviceStates.every(service => service == "active")){
            this.show_active();
        } else if (this.serviceStates.some(service => service == "activating")){
            this.show_activating();
        } else {
            this.show_dead();
        }

        if (this.menu.isOpen){
            this.fillMenu();
        }
    }

    show_empty(){
        this.icon=new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }

    show_active(){
        this.icon=new St.Icon({
            icon_name: 'emblem-ok-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }

    show_activating(){
        this.icon=new St.Icon({
            icon_name: 'content-loading-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this.icon);
    }
 
    show_dead(){
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


export default class SshTunnelExtension extends Extension {

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

