# Hot Module Replacement (HMR) for Angular CLI v6

Enabling Hot Module Replacement (HMR) feature in your Angular CLI v6 project by using Angular Schematics.

## Usage

To enable HMR feature in your Angular CLI v6 project, just enter the following command:

```bash
ng add hmr-enabled
```

## Developments & Tests

```batch
git clone https://github.com/doggy8088/ngcli-hmr-enabled.git
cd ngcli-hmr-enabled
npm install
npm run link

cd ..
ng new demo1
cd demo1
schematics hmr-enabled:ng-add --dry-run
schematics hmr-enabled:ng-add

npm unlink
```

## Unit Testing

There is no bandwidth for unit testing at this time.

`npm run test` will run the unit tests, using Jasmine as a runner and test framework.

## Links

* [Enabling Hot Module Replacement (HMR) in Angular 6 - The Info Grid](https://theinfogrid.com/tech/developers/angular/enabling-hot-module-replacement-angular-6/)
