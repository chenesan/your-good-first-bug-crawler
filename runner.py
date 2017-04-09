#! /usr/bin/env python
import datetime
import os
import subprocess
import time

LOG_PATH = '/var/log/ygfb/ygfb.log'
ERR_LOG_PATH = '/var/log/ygfb/ygfb_err.log'
RUNNER_LOG_PATH = '/var/log/ygfb/runner.log'
PID_PATH = '/var/log/ygfb/runner.pid'
ENV_SH_PATH = './env.sh'

pid_log = open(PID_PATH, 'w')
pid = str(os.getpid())
pid_log.write(pid)
pid_log.close()

log = open(LOG_PATH, 'a')
err_log = open(ERR_LOG_PATH, 'a')
runner_log = open(RUNNER_LOG_PATH, 'a')

runner_log.write('[{time}]Start ygfb crawler runner, pid is {pid}\n'.format(
    time=datetime.datetime.now(), pid=pid
))

ret = 0
call_counter = 0;
while ret != -1:
    runner_log.write(
        '[{time}]Start ygfb crawler {count}th time.\n'.format(
            count=call_counter, time=datetime.datetime.now()
        )
    )
    runner_log.flush()
    ret = subprocess.call("source {env_file}; node crawler.js".format(env_file=ENV_SH_PATH), shell=True, stdout=log, stderr=err_log)
    runner_log.write(
        '[{time}]Successfully finish {count}th crawling\n'.format(
            count=call_counter, time=datetime.datetime.now()
        )
    )
    runner_log.flush()
    call_counter += 1
    # Time for crawler is around 10 minutes
    # We want the crawler run once per hour
    # So sleep 3000 seconds.
    time.sleep(3000)
