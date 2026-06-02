{
  description = "atbbs forums on atproto";

  inputs.nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0";

  outputs = {self, ...} @ inputs: let
    inherit (inputs.nixpkgs) lib;

    supportedSystems = [
      "x86_64-linux"
      "aarch64-linux"
      "aarch64-darwin"
    ];

    forEachSupportedSystem = f:
      lib.genAttrs supportedSystems (
        system:
          f {
            inherit system;
            pkgs = import inputs.nixpkgs {
              inherit system;
              config.allowUnfree = true;
            };
          }
      );
  in {
    formatter = forEachSupportedSystem ({pkgs, ...}: pkgs.alejandra);

    packages = forEachSupportedSystem (
      {pkgs, ...}: {
        default = pkgs.python314Packages.buildPythonPackage {
          pname = "atbbs";
          version = "dev";
          src = ./.;
          pyproject = true;
          build-system = [pkgs.python314Packages.hatchling];

          dependencies = with pkgs.python314Packages; [
            aiohttp
            authlib
            httpx
            piexif
            platformdirs
            rich-click
            textual
          ];
        };
      }
    );
  };
}
