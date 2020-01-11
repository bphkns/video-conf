import {MigrationInterface, QueryRunner} from "typeorm";

export class TeacherName1576324667017 implements MigrationInterface {
    name = 'TeacherName1576324667017'

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL DEFAULT null", undefined);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("ALTER TABLE `class_details` CHANGE `endedAt` `endedAt` timestamp NULL", undefined);
    }

}
