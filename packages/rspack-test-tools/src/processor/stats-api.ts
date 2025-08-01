import type fs from "node:fs";
import { createFsFromVolume, Volume } from "memfs";

import type {
	ECompilerType,
	ITestContext,
	ITestEnv,
	TCompiler,
	TCompilerOptions,
	TCompilerStats
} from "../type";
import { SimpleTaskProcessor } from "./simple";

export interface IStatsAPIProcessorOptions<T extends ECompilerType> {
	options?: (context: ITestContext) => TCompilerOptions<T>;
	name: string;
	compilerType: T;
	snapshotName?: string;
	compiler?: (context: ITestContext, compiler: TCompiler<T>) => Promise<void>;
	build?: (context: ITestContext, compiler: TCompiler<T>) => Promise<void>;
	check?: (stats: TCompilerStats<T>, compiler: TCompiler<T>) => Promise<void>;
}

export class StatsAPIProcessor<
	T extends ECompilerType
> extends SimpleTaskProcessor<T> {
	constructor(protected _statsAPIOptions: IStatsAPIProcessorOptions<T>) {
		super({
			options: context => {
				const res = (_statsAPIOptions.options?.(context) ||
					{}) as TCompilerOptions<ECompilerType.Rspack>;
				res.experiments ??= {};
				res.experiments!.css ??= true;
				res.experiments!.rspackFuture ??= {};
				res.experiments!.rspackFuture!.bundlerInfo ??= {};
				res.experiments!.rspackFuture!.bundlerInfo!.force ??= false;
				if (!global.printLogger) {
					res.infrastructureLogging = {
						level: "error"
					};
				}
				return res as TCompilerOptions<T>;
			},
			build: _statsAPIOptions.build,
			compilerType: _statsAPIOptions.compilerType,
			name: _statsAPIOptions.name,
			compiler: _statsAPIOptions.compiler
		});
	}

	async compiler(context: ITestContext) {
		await super.compiler(context);
		const compiler = this.getCompiler(context).getCompiler();
		if (compiler) {
			compiler.outputFileSystem = createFsFromVolume(
				new Volume()
			) as unknown as typeof fs;
		}
	}
	async run(env: ITestEnv, context: ITestContext) {
		// do nothing
	}

	async check(env: ITestEnv, context: ITestContext) {
		const compiler = this.getCompiler(context);
		const stats = compiler.getStats() as TCompilerStats<T>;
		env.expect(typeof stats).toBe("object");
		await this._statsAPIOptions.check?.(stats!, compiler.getCompiler()!);
	}
}
