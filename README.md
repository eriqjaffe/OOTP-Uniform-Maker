<p align="center">
  <!--<img src="https://i.imgur.com/rjXwOIg.gif">-->
  <img src="https://i.imgur.com/Y9fxqom.gif">
</p>

# OOTP Uniform Maker

An Electron-based dekstop app allowing users to make custom uniforms for [Out of the Park Baseball 23](https://www.ootpdevelopments.com/out-of-the-park-baseball-home) and newer.  If you don't have OOTP, then this will be of little use to you.  Owners of older versions of OOTP should check out my stand-alone [Jersey Maker](https://github.com/eriqjaffe/OOTP-Jersey-Maker) and [Cap Maker](https://github.com/eriqjaffe/OOTP-Cap-Maker) applications, although they will probably not see much further development.

# Pre-requisites

Image processing (for uploaded logos and some of the jersey text effects) *requires* a working installation of [ImageMagick](https://imagemagick.org/script/download.php), version 7 is recommended as it's what I was developing against.  Please note that the app will still run without ImageMagick installed, but some things won't work properly and may cause errors.

# Installation notes

The simplest thing to do is just grab a pre-compiled binary from the "[releases](https://github.com/eriqjaffe/OOTP-Uniform-Maker/releases)" section.  Binaries are available for Windows, macOS and Linux.

Because I'm not a registered developer with Apple, macOS may block the app for security reasons (not a bad thing for it to do, ultimately).  If this happens, just CTRL-click on the app and choose "Open" from the menu - that will bring up a slightly different version of the security message with an option to open the app.  You *should* only have to do that once and macOS should store an exception for the app going forward.

Similarly, Windows might pop up a "Windows protected your PC" message when you try to run the installer.  If that happens, just click "More info" and "Run anyway".

If you wish to run this from source, you will need to install [node.js](https://nodejs.org/en/download/) and [yarn](https://yarnpkg.com/getting-started/install), and then...

```
git clone https://github.com/eriqjaffe/OOTP-Uniform-Maker && cd OOTP-Uniform-Maker
yarn
yarn start
```
