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

const { GObject, St } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;

const Me = imports.misc.extensionUtils.getCurrentExtension()
const Service = Me.imports.utils.service;
const Tunnel = Me.imports.utils.tunnel;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        this.settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
        this.settings.connect('changed', () => {
            this.newSettings = true;
        })
        
        this.show_activating();
        super._init(0.0, _('SSH Tunnel Indicator'));
        this.newSettings = true;
        this.update();
    }

    reloadSettings(){
        this.tunnels = Tunnel.parseTunnels(this.settings.get_strv('tunnels'));
        this.serviceNames = [];
        this.tunnels.filter(tunnel => tunnel.enabled).forEach(tunnel => {
            this.serviceNames.push("sshtunnel."+tunnel.user+"@"+tunnel.id)
        })
        this.showSettingsButton = this.settings.get_boolean('show-settings');
        this.refreshTime = this.settings.get_int('refresh-time');
        this.updateTimeChanged();
        this.newSettings = false;
    }

    saveSettings(){
        let str = Tunnel.stringifyTunnels(this.tunnels);
        this.settings.set_strv("tunnels",str);
    }

    initializeTimer() {
        // used to query sensors and update display
        this.refreshTimeoutId = Mainloop.timeout_add_seconds(this.refreshTime, (self) => {
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

    updateTimeChanged() {
        this.destroyTimer();
        this.initializeTimer();
    }

    update(){
        this.menu.removeAll();
        this.remove_child(this.icon);
        if (this.newSettings){
            this.reloadSettings();
        }

        this.tunnels.forEach(tunnel => {
            const toggle = new PopupMenu.PopupSwitchMenuItem(tunnel.hostname, tunnel.enabled);
            this.menu.addMenuItem(toggle);
            toggle.connect('toggled', () => {
                tunnel.enabled = toggle.state;
                Service.updateTunnelStateAsync(tunnel);
                this.saveSettings();
            });
        });

        let states= Service.getServicesState(this.serviceNames);
        if (states.length <=0){
            this.show_empty();
        }else if (states.every(service => service == "active")){
            this.show_active();
        } else if (states.some(service => service == "activating")){
            this.show_activating();
        } else {
            this.show_dead();
        }
   
        if (this.showSettingsButton) {
            const settings = new PopupMenu.PopupMenuItem(_('Settings'))
            settings.connect('activate', () =>{
                ExtensionUtils.openPrefs();
            })
            this.menu.addMenuItem(settings)
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
