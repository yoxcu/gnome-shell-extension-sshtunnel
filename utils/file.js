const {Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Service           = Me.imports.utils.service;
const Tunnel = Me.imports.utils.tunnel;

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
    let cmd = getMoveFilesCmd(files);
    if (tunnel.enabled) {
        cmd += Service.getRestartServiceCmd(tunnel);
        cmd += Service.getStartServiceCmd(tunnel);
    }
    return Service.runCmd(cmd);
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
    let tunnels = Tunnel.parseTunnels(settings.get_strv("tunnels"));
    let tunnelsSameUser = tunnels.filter(obj => obj.user == tunnel.user);
    let files = ['/etc/default/sshtunnel@' + tunnel.id];
    if (tunnelsSameUser.length <= 1){
        files.push('/etc/systemd/system/sshtunnel.' + tunnel.user + '@.service');
    }
    let cmd = Service.getStopServiceCmd(tunnel);
    cmd += getDeleteFilesCmd(files);
    return Service.runCmd(cmd);
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

//sudo file Operations

function getMoveFilesCmd(files){
    if (files.length <= 0) {
        return true;
    }
    let cmd = ""
    files.forEach(obj => {
        cmd += "mv " + obj[0] + " " + obj[1] + "; ";
    })
    cmd += "systemctl daemon-reload;"
    return cmd;
}

function getDeleteFilesCmd(files){
    if (files.length <= 0) {
        return true;
    }
    let cmd = "";
    files.forEach(obj => {
        cmd += "rm " + obj + "; ";
    })
    cmd += "systemctl daemon-reload;"
    return cmd;
}

//helper Functions

function getStringFromArray(arr,delimiter){
    let str = "";
    arr.forEach(obj => {
        str +=delimiter + " " + obj + " ";
    });
    return str;
}
