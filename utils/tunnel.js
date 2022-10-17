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


function saveTunnel(tunnel){
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    let index = tunnels.findIndex(obj => obj.id ==tunnel.id)
    if (index == -1){
        tunnels.push(tunnel);
    } else {
        tunnels[index]=tunnel;
    }
    let str = stringifyTunnels(tunnels);
    settings.set_strv("tunnels",str);
}

function getNextTunnelId(){
    const settings = ExtensionUtils.getSettings(
        'org.gnome.shell.extensions.sshtunnel');
    let tunnels = parseTunnels(settings.get_strv("tunnels"));
    if (tunnels.length <=0){
        return 0;
    } else {
        return tunnels[tunnels.length-1].id+1;
    }
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
