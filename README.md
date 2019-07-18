# observe-dome
This controller calls the Alpaca API of the Lifferth dome that returns a status object in this format:

```
{
  canSetShutter: true,    // whether or not the shutter is available to be opened or closed
  shutterStatus: 'open'   // the dome status which is either 'open', 'opening', 'closed', 'closing', or 'error'
}
```

If for the controller can't retrieve any of the weather metrics for any reason, it will give the metric a null value.

This controller can also send commands to the dome, namely 'openShutter', 'closeShutter', and 'abortSlew'.

# Setup
Inside the observe-client config, add the controller:

```js
module.exports = {
  firebase: {
    // ...
  },
  controllers: [
    {
      type: 'dome',
      package: 'observe-dome',
      filePath: '/an/absolute/observe-dome/index.js',
      baseUrl: 'https://url.to.observatory.dome/api/v1/observingconditions',
      deviceNumber: 42,
      clientId: 65535
    }
  ]
}
```

# Deploy a new version

1. Execute `npm version patch` - preferrable a patch or minor relea
2. Execute `git push origin master --tags`
3. Execute `npm publish`
4. Withing the remote-observe web client, initiate a reload
