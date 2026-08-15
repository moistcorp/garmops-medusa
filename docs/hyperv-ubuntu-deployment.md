# Hyper-V Ubuntu deployment

This runbook moves the Garmops backend from the Mac to an Ubuntu VM with minimal
downtime. Neon remains the database, while Medusa, Foundry, the customer app,
Redis, ClamAV, and Cloudflared run in Docker.

## 1. Prepare the VM

Create an Ubuntu 24.04 LTS Generation 2 VM in Hyper-V with at least 4 CPU cores,
8 GB RAM, 40 GB disk space, and external network access. Give the VM a stable
DHCP reservation. Microsoft lists Ubuntu 24.04 as supported on Generation 2:
<https://learn.microsoft.com/windows-server/virtualization/hyper-v/plan/should-i-create-a-generation-1-or-2-virtual-machine-in-hyper-v>

Install Git, Docker Engine, and the Docker Compose plugin using Docker's current
Ubuntu instructions: <https://docs.docker.com/engine/install/ubuntu/>. Then
enable Docker at boot and allow your user to run it:

```bash
sudo apt update
sudo apt install -y git openssh-server
sudo systemctl enable --now ssh
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in, then verify:

```bash
docker version
docker compose version
```

## 2. Clone both repositories side by side

```bash
mkdir -p ~/garmops-stack
cd ~/garmops-stack
git clone https://github.com/moistcorp/garmops.git
git clone https://github.com/moistcorp/garmops-medusa.git
```

The directory layout must be:

```text
garmops-stack/
├── garmops/
└── garmops-medusa/
```

## 3. Transfer secrets from the Mac

First run this once on the Mac from `garmops-medusa`:

```bash
./scripts/portable-tunnel-import.sh
```

Replace `VM_USER` and `VM_IP`, then copy the ignored files over SSH:

```bash
scp .env .env.portable VM_USER@VM_IP:~/garmops-stack/garmops-medusa/
scp ../garmops/.env.local VM_USER@VM_IP:~/garmops-stack/garmops/
scp cloudflare/config.yml cloudflare/*.json \
  VM_USER@VM_IP:~/garmops-stack/garmops-medusa/cloudflare/
```

These files contain database, application, and Cloudflare credentials. Never
commit them or send them through email/chat. After transfer, on Ubuntu run:

```bash
chmod 600 ~/garmops-stack/garmops-medusa/.env \
  ~/garmops-stack/garmops-medusa/.env.portable \
  ~/garmops-stack/garmops/.env.local \
  ~/garmops-stack/garmops-medusa/cloudflare/config.yml \
  ~/garmops-stack/garmops-medusa/cloudflare/*.json
```

## 4. Start and verify Ubuntu before cutover

The same named Cloudflare tunnel may temporarily have both Mac and Ubuntu
connectors. This allows verification before stopping the Mac connector.

```bash
cd ~/garmops-stack/garmops-medusa
./scripts/portable-up.sh
./scripts/portable-smoke.sh
./scripts/portable-compose.sh --profile tunnel logs --tail=100 cloudflared
```

Verify these URLs from another device:

```text
https://api.garmops.com/health
https://api.garmops.com/app
https://foundry.garmops.com/login
https://www.garmops.com/configurator
```

The smoke test must report 10 catalog products and a running Cloudflare Tunnel
container. No PostgreSQL transfer is needed because both machines use Neon.

## 5. Complete the cutover

After the Ubuntu connector and public URLs are healthy, stop the Mac Docker
stack from the Mac's `garmops-medusa` directory:

```bash
npm run portable:down
```

Do not run Medusa workers on both hosts longer than necessary.

On Ubuntu, confirm the final state:

```bash
./scripts/portable-compose.sh --profile tunnel ps
curl -fsS https://api.garmops.com/health
```

Docker and all long-running containers start automatically after a VM reboot.
Test this once:

```bash
sudo reboot
```

After reconnecting:

```bash
cd ~/garmops-stack/garmops-medusa
./scripts/portable-smoke.sh
```

## Routine operations

```bash
# Start or update everything, including Cloudflared.
./scripts/portable-up.sh

# Check the full stack.
./scripts/portable-smoke.sh

# Follow logs.
./scripts/portable-compose.sh --profile tunnel logs -f

# Stop everything without deleting Neon data.
npm run portable:down
```

Do not add `-v` unless intentionally deleting local Redis and ClamAV volumes.
Back up the ignored secret files separately; Git intentionally excludes them.

## Rollback

If Ubuntu fails during cutover, stop its stack there, then restart the Mac stack
and tunnel. Neon keeps the database unchanged:

```bash
npm run portable:down
# Run the next command on the Mac.
./scripts/portable-up.sh
```

Only one Medusa worker host should remain active after rollback or cutover.
