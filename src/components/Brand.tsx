import Image from 'next/image';
import Link from 'next/link';

export default function Brand(){
 return <Link href="/" className="brand" aria-label="Treviko home"><Image src="/branding/treviko-logo.png" alt="Treviko" width={744} height={198} className="brandImage" unoptimized/></Link>;
}
