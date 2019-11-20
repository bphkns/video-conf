import {MigrationInterface, QueryRunner} from "typeorm";

export class ClassRefactor1574265371993 implements MigrationInterface {
    name = 'ClassRefactor1574265371993'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` ADD `endedAt` timestamp NULL DEFAULT null", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` DROP COLUMN `endedAt`", undefined);
    }

}
