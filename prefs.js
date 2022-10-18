'use strict';

const { Adw, Gio, Gtk, GLib } = imports.gi;

const Bytes  = imports.byteArray
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Tunnel = Me.imports.utils.tunnel;
const File = Me.imports.utils.file;
const Service = Me.imports.utils.service;

function init() {
}

const defaultHost = "host as in .ssh/config";
const defaultForward = "LOCALPORT:IP_ON_EXAMPLE_COM:PORT_ON_EXAMPLE_COM";
const defaultReverse = "PORT_ON_EXAMPLE_COM:IP_ON_EXAMPLE_COM:LOCALPORT"
const defaultOption = "SSHOption=Value"
const defaultOptions = ["ServerAliveInterval=10", "ServerAliveCountMax=3"]

let mainPage=null;

function fillPreferencesWindow(window) {
    // Use the same GSettings schema as in `extension.js`
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
   // settings.set_strv("tunnels",[]);
    let tunnels = Tunnel.parseTunnels(settings.get_strv("tunnels"));
    
    window.set_can_navigate_back(true);
    mainPage = new Adw.PreferencesPage();
    window.add(mainPage);
    
    //----------------------------------tunnel Group---------------------
    const tunnelGroup = new Adw.PreferencesGroup();
    mainPage.add(tunnelGroup);
    tunnelGroup.set_title("Tunnels");
    
    const newTunnelButton = new Gtk.Button();
    newTunnelButton.set_icon_name("list-add-symbolic");
    newTunnelButton.connect('clicked', () => {
        window.present_subpage(fillEditTunnelPage(window));
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
            if (Service.updateTunnelState(tunnel)){
                toggle.set_state(tunnel.enabled);
                let str = Tunnel.stringifyTunnels(tunnels);
                settings.set_strv("tunnels",str);
            }
            return true;
        });
        row.add_suffix(toggle);
        
        const settingsButton = new Gtk.Button();
        settingsButton.set_icon_name("emblem-system-symbolic");
        settingsButton.connect('clicked', () => {
            window.present_subpage(fillEditTunnelPage(window,tunnel));
        });
        row.add_suffix(settingsButton);

        tunnelGroup.add(row);
    });

    //----------------------------------general Group---------------------
    const generalGroup = new Adw.PreferencesGroup();
    mainPage.add(generalGroup);
    generalGroup.set_title("General Settings");
    const row = new Adw.ActionRow({ title: 'Show Settings Button' });
    generalGroup.add(row);

    const toggle = new Gtk.Switch({
        active: settings.get_boolean ('show-settings'),
        valign: Gtk.Align.CENTER,
    });

    settings.bind(
        'show-settings',
        toggle,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );

    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    const refreshTime = new Adw.EntryRow();
    refreshTime.set_title("Time to refresh Extension");
    refreshTime.set_text(settings.get_int("refresh-time").toString());
    generalGroup.add(refreshTime);
    
    refreshTime.connect("entry-activated", () =>{
        settings.set_int("refresh-time",parseInt(refreshTime.get_text()));
    })

}

function fillEditTunnelPage(window,tunnel=null){
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

    let [forwardsGroup, forwardsRows] = createOptionsGroup(tunnel.forwards,defaultForward);
    forwardsGroup.set_title("Forward Ports");
    editTunnelGroup.add(forwardsGroup);

    let [reversesGroup, reversesRows] = createOptionsGroup(tunnel.reverses,defaultReverse);
    reversesGroup.set_title("Reverse Ports");
    editTunnelGroup.add(reversesGroup);

    let [optionsGroup, optionsRows] = createOptionsGroup(tunnel.options,defaultOption);
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
            tunnel.id = Tunnel.getNextTunnelId();
        }
        if (File.createServiceFiles(tunnel)){
            Tunnel.saveTunnel(tunnel);
            refreshSettingsPage(window);
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
            if (File.deleteServiceFiles(tunnel)) {
                Tunnel.deleteTunnel(tunnel);
                refreshSettingsPage(window);
                window.close_subpage();
            }
        });
        deleteTunnelGroup.add(deleteTunnelButton);
    }

    editTunnelNavRow.add_suffix(confirmButton);
    return editTunnelPage;
}



function createOptionsGroup(options,defaultText){
    const group = new Adw.PreferencesGroup();
    const newButton = new Gtk.Button();
    let rows = [];
    newButton.set_icon_name("list-add-symbolic");
    newButton.connect('clicked', () => {
        createEntryRow(group,defaultText,rows);
    });
    options.forEach(opt => {
        createEntryRow(group,opt,rows);
    })
    group.set_header_suffix(newButton);
    return [group,rows];
}

function createEntryRow(group,text,rows){
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

function refreshSettingsPage(window){
    window.remove(mainPage);
    fillPreferencesWindow(window);
}

//helper functions

function getArrayFromRows(rows){
    let arr = [];
    rows.forEach(row => {
        arr.push(row.get_text());
    });
    return arr;
}

function getCurrentUser(){
    let cmd = "whoami";
    let [ok, out, err, exit] = GLib.spawn_command_line_sync(`${cmd}`);
    return Bytes.toString(out).slice(0,-1);
}


