export interface DesignAsset {
  name: string;
  buffer: Buffer;
}

export interface DesignPage {
  route: string;
  name: string;
  html: string;
  hasScreenshot: boolean;
  screenshot?: Buffer;
}

export interface DesignSystem {
  colors?: string;
  typography?: string;
  spacing?: string;
}

export interface DesignPackage {
  pages: DesignPage[];
  designSystem: DesignSystem;
  assets: DesignAsset[];
}

export interface CliOptions {
  template: string;
  skipFork: boolean;
  skipInstall: boolean;
  skipBuild: boolean;
  packagePath: string;
  projectDir: string;
}
