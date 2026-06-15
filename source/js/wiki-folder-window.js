/*
Class for wiki folder windows
*/

"use strict";

var windowBase = require("./window-base.js"),
	hash = require("./utils/hash.js"),
	fs = require("fs"),
	path = require("path");

// Path of the per-wiki "live state" file for a given wiki identifier.
function liveStateFileFor(identifier) {
	return path.resolve($tw.desktop.gui.App.dataPath,"FolderWikiState",hash.simpleHash(identifier));
}

// Constructor
function WikiFolderWindow(options) {
	var self = this;
	options = options || {};
	// Save the options
	this.windowList = options.windowList;
	this.info = options.info || {};
	this.pathname = options.info.pathname;
	this.mustQuitOnClose = options.mustQuitOnClose;
	// Save the wiki list tiddler
	this.saveWikiListTiddler();
	// Compute (and pre-create) the file used to mirror this wiki's live title and favicon
	this.stateFile = liveStateFileFor(this.getIdentifier());
	try {
		fs.mkdirSync(path.dirname(this.stateFile),{recursive: true});
		if(!fs.existsSync(this.stateFile)) { fs.writeFileSync(this.stateFile,""); }
	} catch(e) {}
	// Get the host, port, credentials and other --listen server options
	var host = $tw.wiki.getTiddlerText(this.getConfigTitle("host"),""),
		port = $tw.wiki.getTiddlerText(this.getConfigTitle("port"),""),
		credentials = $tw.wiki.getTiddlerText(this.getConfigTitle("credentials"),"users.csv"),
		readers = $tw.wiki.getTiddlerText(this.getConfigTitle("readers"),"(anon)"),
		writers = $tw.wiki.getTiddlerText(this.getConfigTitle("writers"),"(authenticated)"),
		pathPrefix = $tw.wiki.getTiddlerText(this.getConfigTitle("path-prefix"),""),
		rootTiddler = $tw.wiki.getTiddlerText(this.getConfigTitle("root-tiddler"),""),
		anonUsername = $tw.wiki.getTiddlerText(this.getConfigTitle("anon-username"),""),
		gzip = $tw.wiki.getTiddlerText(this.getConfigTitle("gzip"),"no");
	// Open the window
	$tw.desktop.gui.Window.open("html/wiki-folder-window.html?pathname=" + encodeURIComponent(this.pathname) + "&host=" + encodeURIComponent(host) + "&port=" + encodeURIComponent(port)
			+ "&credentials=" + encodeURIComponent(credentials) + "&readers=" + encodeURIComponent(readers) + "&writers=" + encodeURIComponent(writers)
			+ "&pathprefix=" + encodeURIComponent(pathPrefix) + "&roottiddler=" + encodeURIComponent(rootTiddler) + "&anonusername=" + encodeURIComponent(anonUsername) + "&gzip=" + encodeURIComponent(gzip)
			+ "&stateFile=" + encodeURIComponent(this.stateFile),this.applyGeometryToOpenOptions({
		id: hash.simpleHash(this.getIdentifier()),
		show: true,
		new_instance: true,
		icon: "images/app-icon.png"
	}),function(win) {
		self.window_nwjs = win;
		self.window_nwjs.once("loaded",self.onloaded.bind(self));
		self.window_nwjs.on("close",self.onclose.bind(self));
		self.trackGeometry();
		self.restoreMaximizedState();
	});
}

// Static method for getting the identifier for the specified info
WikiFolderWindow.getIdentifierFromInfo = function(info) {
	return "wikifolder://" + info.pathname;
};

// Static method for getting the path for the specified info
WikiFolderWindow.getPathnameFromInfo = function(info) {
	return info.pathname;
};

windowBase.addBaseMethods(WikiFolderWindow.prototype);

// Returns true if the provided parameters are the same as the ones used to create this window
WikiFolderWindow.prototype.matchInfo = function(info) {
	return info.pathname === this.pathname;
};

// The identifier for wiki file windows is the prefix `wikifolder://` plus the pathname of the file
WikiFolderWindow.prototype.getIdentifier = function() {
	return "wikifolder://" + this.pathname;
};

// Load handler for window
WikiFolderWindow.prototype.onloaded = function(event) {
	var self = this;
	// Mirror the folder window's live title and favicon into the wiki-list config.
	this.readStateFile();
	try {
		this.stateWatcher = fs.watch(this.stateFile,function() {
			if(self.stateReadTimer) { clearTimeout(self.stateReadTimer); }
			self.stateReadTimer = setTimeout(function() { self.readStateFile(); },50);
		});
		this.stateWatcher.on("error",function() {});
	} catch(e) {}
};

// Read the live-state file and push any changed title/favicon to the wiki-list config.
WikiFolderWindow.prototype.readStateFile = function() {
	var raw, state;
	try { raw = fs.readFileSync(this.stateFile,"utf8"); } catch(e) { return; }
	if(!raw) { return; }
	try { state = JSON.parse(raw); } catch(e) { return; }
	if(state.title && state.title !== this.wikiTitle) {
		this.wikiTitle = state.title;
		this.onTitleChange();
	}
	var favText = state.faviconText || "",
		favType = state.faviconType || "";
	if(favText) {
		if(favText !== this.wikiFavIconText || favType !== this.wikiFavIconType) {
			this.wikiFavIconText = favText;
			this.wikiFavIconType = favType;
			this.onFavIconChange();
		}
	} else {
		this.clearFavIcon();
	}
};

// Reopen this window
WikiFolderWindow.prototype.reopen = function() {
	try { this.window_nwjs.focus(); } catch(e) {}
};

// Get the wiki title
WikiFolderWindow.prototype.getWikiTitle = function() {
	return this.wikiTitle || "";
};

// Get the wiki favicon text
WikiFolderWindow.prototype.getWikiFavIconText = function() {
	return this.wikiFavIconText || "";
};

// Get the wiki favicon type
WikiFolderWindow.prototype.getWikiFavIconType = function() {
	return this.wikiFavIconType || "";
};

// Close handler for window
WikiFolderWindow.prototype.onclose = function(event) {
	// Stop watching the live-state file
	if(this.stateReadTimer) { clearTimeout(this.stateReadTimer); this.stateReadTimer = null; }
	if(this.stateWatcher) {
		try { this.stateWatcher.close(); } catch(e) {}
		this.stateWatcher = null;
	}
	// Close the window, remove it from the window list
	this.windowList.handleClose(this,this.mustRemoveFromWikiListOnClose);
};

// Save a tiddler to the backstage wiki describing this wiki file
WikiFolderWindow.prototype.saveWikiListTiddler = function() {
	var fields = {
		title: this.getIdentifier(),
		tags: ["wikilist","wikifolder"],
		text: ""
	}
	$tw.wiki.addTiddler(new $tw.Tiddler($tw.wiki.getCreationFields(),fields,$tw.wiki.getModificationFields()))
};

exports.WikiFolderWindow = WikiFolderWindow;
exports.liveStateFileFor = liveStateFileFor;
