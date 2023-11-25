'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

const Bytes  = imports.byteArray
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Tunnel from './utils/tunnel.js';
import * as File from './utils/file.js';
import * as Service from './utils/service.js';


const defaultHost = "host as in .ssh/config";
const defaultForward = "LOCALPORT:IP_ON_EXAMPLE_COM:PORT_ON_EXAMPLE_COM";
const defaultReverse = "PORT_ON_EXAMPLE_COM:IP_ON_EXAMPLE_COM:LOCALPORT"
const defaultOption = "SSHOption=Value"
const defaultOptions = ["ServerAliveInterval=10", "ServerAliveCountMax=3"]

export default class MyExtensionPreferences extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        // Use the same GSettings schema as in `extension.js`
        this.extensionObject = ExtensionPreferences.lookupByUUID('sshtunnel@yoxcu.de');
        this.settings = this.extensionObject.getSettings('org.gnome.shell.extensions.sshtunnel');
       // settings.set_strv("tunnels",[]);
        const tunnels = Tunnel.parseTunnels(this.settings.get_strv("tunnels"));
        
        window.set_can_navigate_back(true);
        this.mainPage = new Adw.PreferencesPage();
        window.add(this.mainPage);
        
        //----------------------------------tunnel Group---------------------
        const tunnelGroup = new Adw.PreferencesGroup();
        this.mainPage.add(tunnelGroup);
        tunnelGroup.set_title("Tunnels");
        
        const newTunnelButton = new Gtk.Button();
        newTunnelButton.set_icon_name("list-add-symbolic");
        newTunnelButton.connect('clicked', () => {
            window.present_subpage(this.fillEditTunnelPage(window));
        });
        tunnelGroup.set_header_suffix(newTunnelButton);


        tunnels.forEach(tunnel => {
            const row = new Adw.ActionRow({ title: tunnel.hostname });
            const toggle = new Gtk.Switch({
                active: tunnel.enabled,
                valign: Gtk.Align.CENTER,
            });
            toggle.connect('state-set', () => {
                tunnel.enabled = toggle.active;
                if (Service.updateServiceState(tunnel)){
                    toggle.set_state(tunnel.enabled);
                    const str = Tunnel.stringifyTunnels(tunnels);
                    this.settings.set_strv("tunnels",str);
                }
                return true;
            });
            row.add_suffix(toggle);
            
            const settingsButton = new Gtk.Button();
            settingsButton.set_icon_name("emblem-system-symbolic");
            settingsButton.connect('clicked', () => {
                window.present_subpage(this.fillEditTunnelPage(window,tunnel));
            });
            row.add_suffix(settingsButton);

            tunnelGroup.add(row);
        });

        //----------------------------------general Group---------------------
        const generalGroup = new Adw.PreferencesGroup();
        this.mainPage.add(generalGroup);
        generalGroup.set_title("General Settings");
        const row = new Adw.ActionRow({ title: 'Show Settings Button' });
        generalGroup.add(row);

        const toggle = new Gtk.Switch({
            active: this.settings.get_boolean ('show-settings'),
            valign: Gtk.Align.CENTER,
        });

        this.settings.bind(
            'show-settings',
            toggle,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        row.add_suffix(toggle);
        row.activatable_widget = toggle;

        const refreshTime = new Adw.EntryRow();
        refreshTime.set_title("Time to refresh Extension");
        refreshTime.set_text(this.settings.get_int("refresh-time").toString());
        generalGroup.add(refreshTime);
        
        refreshTime.connect("entry-activated", () =>{
            this.settings.set_int("refresh-time",parseInt(refreshTime.get_text()));
        })

    }

    fillEditTunnelPage(window,tunnel=null){
        let edit=true;
        if (tunnel == null) {
            tunnel = new Tunnel.Tunnel(defaultHost,[],[],defaultOptions,getCurrentUser())
            edit=false;
        }
        const editTunnelPage = new Adw.PreferencesPage();
        const editTunnelNavGroup = new Adw.PreferencesGroup();
        editTunnelPage.add(editTunnelNavGroup);

        const editTunnelNavRow = new Adw.ActionRow();
        editTunnelNavGroup.add(editTunnelNavRow);
        
        const backButton = new Gtk.Button();
        backButton.set_icon_name("");
        backButton.set_label("Back");
        backButton.connect('clicked', () => {
            window.close_subpage();
        });
        editTunnelNavRow.add_prefix(backButton);

        const editTunnelGroup = new Adw.PreferencesGroup();
        editTunnelGroup.set_title("Tunnel Properties")
        editTunnelPage.add(editTunnelGroup);

        const tunnelUser = new Adw.EntryRow();
        tunnelUser.set_title("Local User to execute Service");
        tunnelUser.set_text(tunnel.user);
        editTunnelGroup.add(tunnelUser);

        const tunnelHost = new Adw.EntryRow();
        tunnelHost.set_title("SSH Host");
        tunnelHost.set_text(tunnel.hostname);
        editTunnelGroup.add(tunnelHost);

        const [forwardsGroup, forwardsRows] = this.createOptionsGroup(tunnel.forwards,defaultForward);
        forwardsGroup.set_title("Forward Ports");
        editTunnelGroup.add(forwardsGroup);

        const [reversesGroup, reversesRows] = this.createOptionsGroup(tunnel.reverses,defaultReverse);
        reversesGroup.set_title("Reverse Ports");
        editTunnelGroup.add(reversesGroup);

        const [optionsGroup, optionsRows] = this.createOptionsGroup(tunnel.options,defaultOption);
        optionsGroup.set_title("Additional SSH Options");
        editTunnelGroup.add(optionsGroup);

        const confirmButton = new Gtk.Button();
        confirmButton.set_icon_name("");
        if (edit) {
            confirmButton.set_label("Save");
        }else {
            confirmButton.set_label("Add");
        }
        confirmButton.connect('clicked', () => {
            tunnel.hostname=tunnelHost.get_text();
            tunnel.user=tunnelUser.get_text();
            tunnel.forwards=getArrayFromRows(forwardsRows);
            tunnel.reverses=getArrayFromRows(reversesRows);
            tunnel.options=getArrayFromRows(optionsRows);
            if (tunnel.id == null){
                tunnel.id = Tunnel.getNextTunnelId(this.settings);
            }
            if (File.createServiceFiles(tunnel)){
                Tunnel.saveTunnel(this.settings,tunnel);
                this.refreshSettingsPage(window);
                window.close_subpage();
            }
        });

        if (edit){
            const deleteTunnelGroup = new Adw.PreferencesGroup();
            editTunnelPage.add(deleteTunnelGroup);

            const deleteTunnelButton = new Gtk.Button();
            deleteTunnelButton.set_icon_name("");
            deleteTunnelButton.set_label("Delete Tunnel");
            deleteTunnelButton.connect('clicked', () => {
                if (File.deleteServiceFiles(this.settings,tunnel)) {
                    Tunnel.deleteTunnel(this.settings,tunnel);
                    this.refreshSettingsPage(window);
                    window.close_subpage();
                }
            });
            deleteTunnelGroup.add(deleteTunnelButton);
        }

        editTunnelNavRow.add_suffix(confirmButton);
        return editTunnelPage;
    }



    createOptionsGroup(options,defaultText){
        const group = new Adw.PreferencesGroup();
        const newButton = new Gtk.Button();
        let rows = [];
        newButton.set_icon_name("list-add-symbolic");
        newButton.connect('clicked', () => {
            this.createEntryRow(group,defaultText,rows);
        });
        options.forEach(opt => {
            this.createEntryRow(group,opt,rows);
        })
        group.set_header_suffix(newButton);
        return [group,rows];
    }

    createEntryRow(group,text,rows){
        const entryRow = new Adw.EntryRow();
        entryRow.set_text(text);
        const delButton = new Gtk.Button();
        delButton.set_icon_name("edit-delete-symbolic");
        delButton.connect('clicked', () => {
            group.remove(entryRow);
            const index = rows.indexOf(entryRow);
            if (index > -1) { // only splice array when item is found
                rows.splice(index, 1); // 2nd parameter means remove one item only
            }
        });
        entryRow.add_suffix(delButton);
        group.add(entryRow);
        rows.push(entryRow)
    }

    refreshSettingsPage(window){
        window.remove(this.mainPage);
        this.fillPreferencesWindow(window);
    }
}
//helper functions

function getArrayFromRows(rows){
    const arr = [];
    rows.forEach(row => {
        arr.push(row.get_text());
    });
    return arr;
}

function getCurrentUser(){
    const cmd = "whoami";
    const [ok, out, err, exit] = GLib.spawn_command_line_sync(`${cmd}`);
    return Bytes.toString(out).slice(0,-1);
}


