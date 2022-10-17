'use strict';

const { Adw, Gio, Gtk, GLib } = imports.gi;

const Bytes  = imports.byteArray
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Utils             = Me.imports.utils;
const Service           = Me.imports.service;

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
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    
    window.set_can_navigate_back(true);
   
    // Create a preferences page and group
    mainPage = new Adw.PreferencesPage();
    window.connect('activate-default', () => {
        print("shown");
    })
    const tunnelGroup = new Adw.PreferencesGroup();

    const newTunnelButton = new Gtk.Button();
    newTunnelButton.set_icon_name("list-add-symbolic");
    newTunnelButton.connect('clicked', () => {
        print("Button clicked!");
        window.present_subpage(fillEditTunnelPage(window));
    });

    tunnelGroup.set_title("Tunnels");
    tunnelGroup.set_header_suffix(newTunnelButton);

    mainPage.add(tunnelGroup);

    tunnels.forEach(obj => {
        const row = new Adw.ActionRow({ title: obj.hostname });
        const toggle = new Gtk.Switch({
            active: obj.enabled,
            valign: Gtk.Align.CENTER,
        });
        row.add_suffix(toggle);
        
        const settingsButton = new Gtk.Button();
        settingsButton.set_icon_name("emblem-system-symbolic");
        settingsButton.connect('clicked', () => {
            window.present_subpage(fillEditTunnelPage(window,obj));
        });
        row.add_suffix(settingsButton);

        tunnelGroup.add(row);
    });

    // Create a new preferences row
    const row = new Adw.ActionRow({ title: 'Show Add Button' });
    tunnelGroup.add(row);

    // Create the switch and bind its value to the `show-indicator` key
    const toggle = new Gtk.Switch({
        active: settings.get_boolean ('show-add'),
        valign: Gtk.Align.CENTER,
    });
    settings.bind(
        'show-add',
        toggle,
        'active',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Add the switch to the row
    row.add_suffix(toggle);
    row.activatable_widget = toggle;

    // Add our page to the window
    window.add(mainPage);
}

function fillEditTunnelPage(window,tunnel=null){
    let edit=true;
    if (tunnel == null) {
        tunnel = new Utils.Tunnel(defaultHost,[],[],defaultOptions,getCurrentUser())
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
        print("Button clicked!");
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

        if (createServiceFiles(tunnel)){
            saveTunnel(tunnel);
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
            if (deleteServiceFiles(tunnel)) {
                deleteTunnel(tunnel);
                refreshSettingsPage(window);
                window.close_subpage();
            }
        });
        deleteTunnelGroup.add(deleteTunnelButton);
    }

    editTunnelNavRow.add_suffix(confirmButton);
    return editTunnelPage;
}

function getArrayFromRows(rows){
    let arr = [];
    rows.forEach(row => {
        arr.push(row.get_text());
    });
    print(arr);
    return arr;
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

function saveTunnel(tunnel){
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
    let tunnels = parseTunnels(settings.get_strv("tunnels"));

    if (tunnel.id==null){
        if (tunnels.length <=0){
            tunnel.id=0;
        } else {
            tunnel.id=tunnels[tunnels.length-1].id+1;
        }
        tunnels.push(tunnel);
    }else{
        let id = tunnels.findIndex(obj => obj.id ==tunnel.id)
        tunnels[id]=tunnel;
    }

    let str = stringifyTunnels(tunnels);
    settings.set_strv("tunnels",str);
}

function deleteTunnel(tunnel){
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    let id = tunnels.findIndex(obj => obj.id ==tunnel.id)
    tunnels.splice(id, 1); // 2nd parameter means remove one item only
    let str = stringifyTunnels(tunnels);
    settings.set_strv("tunnels",str);
}

function createServiceFiles(tunnel){
    let files = [];
    let serviceFile = getServiceFile(tunnel);
    if (serviceFile != null){
        files.push(serviceFile);
    }
    let tunnelFile = getTunnelFile(tunnel);
    if (tunnelFile != null){
        files.push(tunnelFile);
    }
    return moveFiles(files);
}

function getServiceFile(tunnel){
    const serviceFile = Gio.File.new_for_path('/etc/systemd/system/sshtunnel.' + tunnel.user + '@.service');
    let replacements = {"%USER%":tunnel.user};
    let str = Service.getServiceFile().replace(/%\w+%/g, function(all) {
        return replacements[all] || "";
    });

    if (serviceFile.query_exists(null)){
        if (checkFileContent(serviceFile.get_path(),str)) {
            return null;
        }
    }
    const [tempFile,] = Gio.File.new_tmp(null);
    const res = tempFile.replace_contents(str, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    return [tempFile.get_path(),serviceFile.get_path()];
}

function getTunnelFile(tunnel){
    const tunnelFile = Gio.File.new_for_path('/etc/default/sshtunnel@' + tunnel.id);
    let forwards = getStringFromArray(tunnel.forwards,"-L");
    let reverses = getStringFromArray(tunnel.reverses,"-R");
    let options = getStringFromArray(tunnel.options,"-o");
    let replacements = {"%HOSTNAME%":tunnel.hostname,"%FORWARDS%":forwards,"%REVERSES%":reverses,"%OPTIONS%":options};
    let str = Service.getTunnelFile().replace(/%\w+%/g, function(all) {
        return replacements[all] || "";
    });

    if (tunnelFile.query_exists(null)){
        if (checkFileContent(tunnelFile.get_path(),str)) {
            return null;
        }
    }
    const [tempFile,] = Gio.File.new_tmp(null);
    const res = tempFile.replace_contents(str, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    return [tempFile.get_path(),tunnelFile.get_path()];
}

function deleteServiceFiles(tunnel){
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    let tunnelsSameUser = tunnels.filter(obj => obj.user == tunnel.user);
    let files = ['/etc/default/sshtunnel@' + tunnel.id];
    if (tunnelsSameUser.length = 1){
        files.push('/etc/systemd/system/sshtunnel.' + tunnel.user + '@.service');
    }
    return deleteFiles(files);
}

function getStringFromArray(arr,delimiter){
    let str = "";
    arr.forEach(obj => {
        str +=delimiter + " " + obj + " ";
    });
    return str;
}

function checkFileContent(path,text){
    const file = Gio.File.new_for_path(path);
    if (file.query_exists(null)){
        const [, contents, etag] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const contentsString = decoder.decode(contents);
        if (text==contentsString){
            return true;
        }
    }
    return false;
}

function moveFiles(files){
    if (files.length <= 0) {
        return true;
    }
    let cmd = ""
    files.forEach(obj => {
        cmd += "mv " + obj[0] + " " + obj[1] + "; ";
    })
    cmd += "systemctl daemon-reload;"
    const res = GLib.spawn_command_line_sync(`pkexec sh -c "${cmd}"`);
    return res[3]==0;
}

function deleteFiles(files){
    if (files.length <= 0) {
        return true;
    }
    let cmd = "";
    files.forEach(obj => {
        cmd += "rm " + obj + "; ";
    })
    cmd += "systemctl daemon-reload;"
    print(cmd);
    let [ok, out, err, exit] = GLib.spawn_command_line_sync(`pkexec sh -c "${cmd}"`);
    return exit == 0;
}

function getCurrentUser(){
    let cmd = "whoami";
    let [ok, out, err, exit] = GLib.spawn_command_line_sync(`${cmd}`);
    return Bytes.toString(out).slice(0,-1);
}

function parseTunnels(str){
    let tunnels = [];
    str.forEach(obj => {
        tunnels.push(JSON.parse(obj));
    });
    return tunnels;
}

function stringifyTunnels(tunnels){
    let str = [];
    tunnels.forEach(obj => {
        str.push(JSON.stringify(obj));
    });
    return str;
}
