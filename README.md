# your-good-first-bug-crawler

Data (Github issue and repo) crawler for [your-good-first-bug](https://github.com/chenesan/your-good-first-bug).

## Build

`npm i`

## Run

```bash
# At first you have to fill in the environment variable in `env.sh`, and load it.
source env.sh
# This will start a runner in Python. It will crawl issues on github once an hour.
npm start
```

## Stop
```bash
# This will stop the crawler runner.
npm stop
```
