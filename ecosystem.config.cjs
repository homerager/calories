module.exports = {
  apps: [{
    name: 'calories',
    script: '.output/server/index.mjs',
    cwd: '/var/www/calories',
    env_file: '/var/www/calories/.env',
    env: { NITRO_PORT: '3001', NODE_ENV: 'production' },
    instances: 1,
    exec_mode: 'fork'
  }]
}
