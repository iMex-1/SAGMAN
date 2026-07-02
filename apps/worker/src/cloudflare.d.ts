interface R2Bucket {
  createSignedUrl(
    key: string,
    options: {
      method: 'GET' | 'PUT' | 'DELETE';
      expiresIn?: number;
      httpMetadata?: R2HTTPMetadata;
      customMetadata?: Record<string, string>;
    },
  ): Promise<string>;
}
