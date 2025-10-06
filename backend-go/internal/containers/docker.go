package containers

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

// StartBrowserContainer starts a disposable chromium container and returns access url
func StartBrowserContainer(sessionID string) (string, error){
	cli, err := client.NewClientWithOpts(client.FromEnv)
	if err != nil {
		return "", err
	}

	ctx := context.Background()
	//Define ports and container config
	exposedPorts := nat.PortSet{
		"3000/tcp": struct {}{},
	}
	portBindings := nat.PortMap {
		"3000/tcp": []nat.PortBinding{
			{
				HostIP: "0.0.0.0",
				HostPort: "",
			},
		},
	}

	//create container config
	containerConfig := &container.Config{
		Image: "linuxserver/chromium:latest",
		ExposedPorts: exposedPorts,
		Env: []string{
			"PUID=1000",
			"PGID=1000",
			"TZ=UTC",
			"CHROME_CLI=https://www.duckduckgo.com",
            "CHROME_OPTS=--no-sandbox --disable-dev-shm-usage",
		},
	}

	hostConfig := &container.HostConfig{
		PortBindings: portBindings,
		AutoRemove: true,
		ShmSize: 3221225472 , // 3GB
		SecurityOpt: []string{"seccomp=unconfined"},
	}

	networkingConfig := &network.NetworkingConfig{
		//create container
		resp, err := cli.ContainerCreate(ctx, containerConfig,hostConfig,networkingConfig, nil , sessionID )
	}

	if err != nil {
		return "", err
	}

	if err := cli.ContainerStart(ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		return "", err
	}

	//Construct access URL (using traefik and domain logic)
	accessURL := fmt.Sprintf("https://%s.disposable-services.duckdns.go", sessionID)
	return accessURL, nil 
}

// StopBrowserContainer stops container by session ID
func StopBrowserContainer(sessionID string) error {
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        return err
    }
    ctx := context.Background()
    return cli.ContainerStop(ctx, sessionID, nil)
}
