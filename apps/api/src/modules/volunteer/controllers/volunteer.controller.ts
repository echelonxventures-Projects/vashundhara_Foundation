/**
 * Volunteer Controller for Vashundhara Foundation API
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { VolunteerService } from '../services/volunteer.service';
import {
  CreateVolunteerDto,
  UpdateVolunteerDto,
  VolunteerQueryDto,
  VolunteerResponseDto,
  CreateShiftDto,
  UpdateShiftDto,
  ShiftQueryDto,
  ShiftResponseDto,
  CreateShiftAssignmentDto,
  UpdateShiftAssignmentDto,
  ShiftAssignmentQueryDto,
  ShiftAssignmentResponseDto,
  CreateSkillDto,
  UpdateSkillDto,
  SkillResponseDto,
  CreateVolunteerSkillDto,
  UpdateVolunteerSkillDto,
  VolunteerSkillResponseDto,
  CreateHoursLogDto,
  UpdateHoursLogDto,
  HoursLogQueryDto,
  HoursLogResponseDto,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  AvailabilityResponseDto,
  VolunteerStatsDto
} from '../dto';

@ApiTags('Volunteer')
@Controller('volunteer')
export class VolunteerController {
  constructor(private readonly volunteerService: VolunteerService) {}

  // ============================================
  // Volunteer Endpoints
  // ============================================

  @Get('volunteers')
  @ApiOperation({ summary: 'List all volunteers with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of volunteers' })
  async findAllVolunteers(@Query() query: VolunteerQueryDto) {
    return this.volunteerService.findAllVolunteers(query);
  }

  @Get('volunteers/:id')
  @ApiOperation({ summary: 'Get a volunteer by ID' })
  @ApiResponse({ status: 200, description: 'Volunteer details' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  async findVolunteerById(@Param('id') id: string) {
    return this.volunteerService.findVolunteerById(id);
  }

  @Post('volunteers')
  @ApiOperation({ summary: 'Create a new volunteer' })
  @ApiResponse({ status: 201, description: 'Volunteer created successfully' })
  @ApiResponse({ status: 409, description: 'Volunteer with this email already exists' })
  async createVolunteer(@Body() dto: CreateVolunteerDto) {
    return this.volunteerService.createVolunteer(dto);
  }

  @Put('volunteers/:id')
  @ApiOperation({ summary: 'Update a volunteer' })
  @ApiResponse({ status: 200, description: 'Volunteer updated successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  @ApiResponse({ status: 409, description: 'Volunteer with this email already exists' })
  async updateVolunteer(@Param('id') id: string, @Body() dto: UpdateVolunteerDto) {
    return this.volunteerService.updateVolunteer(id, dto);
  }

  @Delete('volunteers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a volunteer (soft delete)' })
  @ApiResponse({ status: 200, description: 'Volunteer deleted successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  async deleteVolunteer(@Param('id') id: string) {
    return this.volunteerService.deleteVolunteer(id);
  }

  // ============================================
  // Shift Endpoints
  // ============================================

  @Get('shifts')
  @ApiOperation({ summary: 'List all shifts with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of shifts' })
  async findAllShifts(@Query() query: ShiftQueryDto) {
    return this.volunteerService.findAllShifts(query);
  }

  @Get('shifts/:id')
  @ApiOperation({ summary: 'Get a shift by ID' })
  @ApiResponse({ status: 200, description: 'Shift details' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async findShiftById(@Param('id') id: string) {
    return this.volunteerService.findShiftById(id);
  }

  @Post('shifts')
  @ApiOperation({ summary: 'Create a new shift' })
  @ApiResponse({ status: 201, description: 'Shift created successfully' })
  async createShift(@Body() dto: CreateShiftDto) {
    return this.volunteerService.createShift(dto);
  }

  @Put('shifts/:id')
  @ApiOperation({ summary: 'Update a shift' })
  @ApiResponse({ status: 200, description: 'Shift updated successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async updateShift(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.volunteerService.updateShift(id, dto);
  }

  @Put('shifts/:id/publish')
  @ApiOperation({ summary: 'Publish a shift' })
  @ApiResponse({ status: 200, description: 'Shift published successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async publishShift(@Param('id') id: string) {
    return this.volunteerService.publishShift(id);
  }

  @Put('shifts/:id/cancel')
  @ApiOperation({ summary: 'Cancel a shift' })
  @ApiResponse({ status: 200, description: 'Shift cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async cancelShift(@Param('id') id: string) {
    return this.volunteerService.cancelShift(id);
  }

  @Delete('shifts/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a shift (soft delete)' })
  @ApiResponse({ status: 200, description: 'Shift deleted successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async deleteShift(@Param('id') id: string) {
    return this.volunteerService.deleteShift(id);
  }

  // ============================================
  // Shift Assignment Endpoints
  // ============================================

  @Get('assignments')
  @ApiOperation({ summary: 'List all shift assignments with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of shift assignments' })
  async findAllAssignments(@Query() query: ShiftAssignmentQueryDto) {
    return this.volunteerService.findAllAssignments(query);
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get a shift assignment by ID' })
  @ApiResponse({ status: 200, description: 'Shift assignment details' })
  @ApiResponse({ status: 404, description: 'Shift assignment not found' })
  async findAssignmentById(@Param('id') id: string) {
    return this.volunteerService.findAssignmentById(id);
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Create a new shift assignment (register volunteer for shift)' })
  @ApiResponse({ status: 201, description: 'Assignment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid shift or volunteer, or shift is full' })
  @ApiResponse({ status: 409, description: 'Volunteer already assigned to this shift' })
  async createAssignment(@Body() dto: CreateShiftAssignmentDto) {
    return this.volunteerService.createAssignment(dto);
  }

  @Put('assignments/:id')
  @ApiOperation({ summary: 'Update a shift assignment' })
  @ApiResponse({ status: 200, description: 'Assignment updated successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async updateAssignment(@Param('id') id: string, @Body() dto: UpdateShiftAssignmentDto) {
    return this.volunteerService.updateAssignment(id, dto);
  }

  @Put('assignments/:id/check-in')
  @ApiOperation({ summary: 'Check in volunteer for shift' })
  @ApiResponse({ status: 200, description: 'Volunteer checked in successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({ status: 400, description: 'Cannot check in - invalid status' })
  async checkIn(@Param('id') id: string) {
    return this.volunteerService.checkIn(id);
  }

  @Put('assignments/:id/check-out')
  @ApiOperation({ summary: 'Check out volunteer from shift' })
  @ApiResponse({ status: 200, description: 'Volunteer checked out successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @ApiResponse({ status: 400, description: 'Cannot check out - not checked in' })
  async checkOut(@Param('id') id: string) {
    return this.volunteerService.checkOut(id);
  }

  @Put('assignments/:id/complete')
  @ApiOperation({ summary: 'Mark assignment as completed' })
  @ApiResponse({ status: 200, description: 'Assignment completed successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async completeAssignment(@Param('id') id: string, @Body() body: { hoursCredited?: number; notes?: string }) {
    return this.volunteerService.completeAssignment(id, body.hoursCredited, body.notes);
  }

  @Put('assignments/:id/cancel')
  @ApiOperation({ summary: 'Cancel a shift assignment' })
  @ApiResponse({ status: 200, description: 'Assignment cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async cancelAssignment(@Param('id') id: string) {
    return this.volunteerService.cancelAssignment(id);
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a shift assignment (soft delete)' })
  @ApiResponse({ status: 200, description: 'Assignment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async deleteAssignment(@Param('id') id: string) {
    return this.volunteerService.deleteAssignment(id);
  }

  // ============================================
  // Skill Endpoints
  // ============================================

  @Get('skills')
  @ApiOperation({ summary: 'List all skills' })
  @ApiResponse({ status: 200, description: 'List of skills' })
  async findAllSkills() {
    return this.volunteerService.findAllSkills();
  }

  @Get('skills/:id')
  @ApiOperation({ summary: 'Get a skill by ID' })
  @ApiResponse({ status: 200, description: 'Skill details' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async findSkillById(@Param('id') id: string) {
    return this.volunteerService.findSkillById(id);
  }

  @Post('skills')
  @ApiOperation({ summary: 'Create a new skill' })
  @ApiResponse({ status: 201, description: 'Skill created successfully' })
  async createSkill(@Body() dto: CreateSkillDto) {
    return this.volunteerService.createSkill(dto);
  }

  @Put('skills/:id')
  @ApiOperation({ summary: 'Update a skill' })
  @ApiResponse({ status: 200, description: 'Skill updated successfully' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async updateSkill(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.volunteerService.updateSkill(id, dto);
  }

  @Delete('skills/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a skill (soft delete)' })
  @ApiResponse({ status: 200, description: 'Skill deleted successfully' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async deleteSkill(@Param('id') id: string) {
    return this.volunteerService.deleteSkill(id);
  }

  // ============================================
  // Volunteer Skill Endpoints
  // ============================================

  @Get('volunteers/:volunteerId/skills')
  @ApiOperation({ summary: 'Get all skills for a volunteer' })
  @ApiResponse({ status: 200, description: 'List of volunteer skills' })
  async findVolunteerSkills(@Param('volunteerId') volunteerId: string) {
    return this.volunteerService.findVolunteerSkills(volunteerId);
  }

  @Post('volunteers/:volunteerId/skills')
  @ApiOperation({ summary: 'Add a skill to a volunteer' })
  @ApiResponse({ status: 201, description: 'Skill added to volunteer successfully' })
  @ApiResponse({ status: 400, description: 'Invalid volunteer or skill' })
  @ApiResponse({ status: 409, description: 'Volunteer already has this skill' })
  async addVolunteerSkill(@Param('volunteerId') volunteerId: string, @Body() dto: Omit<CreateVolunteerSkillDto, 'volunteerId'>) {
    return this.volunteerService.addVolunteerSkill(volunteerId, dto);
  }

  @Put('volunteers/:volunteerId/skills/:skillId')
  @ApiOperation({ summary: 'Update a volunteer skill' })
  @ApiResponse({ status: 200, description: 'Volunteer skill updated successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer skill not found' })
  async updateVolunteerSkill(@Param('volunteerId') volunteerId: string, @Param('skillId') skillId: string, @Body() dto: UpdateVolunteerSkillDto) {
    return this.volunteerService.updateVolunteerSkill(volunteerId, skillId, dto);
  }

  @Put('volunteers/:volunteerId/skills/:skillId/verify')
  @ApiOperation({ summary: 'Verify a volunteer skill' })
  @ApiResponse({ status: 200, description: 'Skill verified successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer skill not found' })
  async verifyVolunteerSkill(@Param('volunteerId') volunteerId: string, @Param('skillId') skillId: string, @Body() body: { verifiedBy: string; certificationUrl?: string }) {
    return this.volunteerService.verifyVolunteerSkill(volunteerId, skillId, body.verifiedBy, body.certificationUrl);
  }

  @Delete('volunteers/:volunteerId/skills/:skillId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a skill from a volunteer' })
  @ApiResponse({ status: 200, description: 'Skill removed successfully' })
  @ApiResponse({ status: 404, description: 'Volunteer skill not found' })
  async removeVolunteerSkill(@Param('volunteerId') volunteerId: string, @Param('skillId') skillId: string) {
    return this.volunteerService.removeVolunteerSkill(volunteerId, skillId);
  }

  // ============================================
  // Hours Log Endpoints
  // ============================================

  @Get('hours-logs')
  @ApiOperation({ summary: 'List all hours logs with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of hours logs' })
  async findAllHoursLogs(@Query() query: HoursLogQueryDto) {
    return this.volunteerService.findAllHoursLogs(query);
  }

  @Get('hours-logs/:id')
  @ApiOperation({ summary: 'Get an hours log by ID' })
  @ApiResponse({ status: 200, description: 'Hours log details' })
  @ApiResponse({ status: 404, description: 'Hours log not found' })
  async findHoursLogById(@Param('id') id: string) {
    return this.volunteerService.findHoursLogById(id);
  }

  @Post('hours-logs')
  @ApiOperation({ summary: 'Create a new hours log' })
  @ApiResponse({ status: 201, description: 'Hours log created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid volunteer or shift' })
  async createHoursLog(@Body() dto: CreateHoursLogDto) {
    return this.volunteerService.createHoursLog(dto);
  }

  @Put('hours-logs/:id')
  @ApiOperation({ summary: 'Update an hours log' })
  @ApiResponse({ status: 200, description: 'Hours log updated successfully' })
  @ApiResponse({ status: 404, description: 'Hours log not found' })
  async updateHoursLog(@Param('id') id: string, @Body() dto: UpdateHoursLogDto) {
    return this.volunteerService.updateHoursLog(id, dto);
  }

  @Put('hours-logs/:id/approve')
  @ApiOperation({ summary: 'Approve an hours log' })
  @ApiResponse({ status: 200, description: 'Hours log approved successfully' })
  @ApiResponse({ status: 404, description: 'Hours log not found' })
  async approveHoursLog(@Param('id') id: string, @Body() body: { verifiedBy: string }) {
    return this.volunteerService.approveHoursLog(id, body.verifiedBy);
  }

  @Put('hours-logs/:id/reject')
  @ApiOperation({ summary: 'Reject an hours log' })
  @ApiResponse({ status: 200, description: 'Hours log rejected successfully' })
  @ApiResponse({ status: 404, description: 'Hours log not found' })
  async rejectHoursLog(@Param('id') id: string, @Body() body: { verifiedBy: string; reason?: string }) {
    return this.volunteerService.rejectHoursLog(id, body.verifiedBy, body.reason);
  }

  @Delete('hours-logs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an hours log (soft delete)' })
  @ApiResponse({ status: 200, description: 'Hours log deleted successfully' })
  @ApiResponse({ status: 404, description: 'Hours log not found' })
  async deleteHoursLog(@Param('id') id: string) {
    return this.volunteerService.deleteHoursLog(id);
  }

  // ============================================
  // Availability Endpoints
  // ============================================

  @Get('volunteers/:volunteerId/availabilities')
  @ApiOperation({ summary: 'Get all availabilities for a volunteer' })
  @ApiResponse({ status: 200, description: 'List of volunteer availabilities' })
  async findVolunteerAvailabilities(@Param('volunteerId') volunteerId: string) {
    return this.volunteerService.findVolunteerAvailabilities(volunteerId);
  }

  @Post('volunteers/:volunteerId/availabilities')
  @ApiOperation({ summary: 'Create a new availability for a volunteer' })
  @ApiResponse({ status: 201, description: 'Availability created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid volunteer' })
  async createAvailability(@Param('volunteerId') volunteerId: string, @Body() dto: Omit<CreateAvailabilityDto, 'volunteerId'>) {
    return this.volunteerService.createAvailability(volunteerId, dto);
  }

  @Put('availabilities/:id')
  @ApiOperation({ summary: 'Update an availability' })
  @ApiResponse({ status: 200, description: 'Availability updated successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  async updateAvailability(@Param('id') id: string, @Body() dto: UpdateAvailabilityDto) {
    return this.volunteerService.updateAvailability(id, dto);
  }

  @Delete('availabilities/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an availability (soft delete)' })
  @ApiResponse({ status: 200, description: 'Availability deleted successfully' })
  @ApiResponse({ status: 404, description: 'Availability not found' })
  async deleteAvailability(@Param('id') id: string) {
    return this.volunteerService.deleteAvailability(id);
  }

  // ============================================
  // Dashboard / Stats Endpoints
  // ============================================

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get volunteer dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  async getDashboardStats() {
    return this.volunteerService.getDashboardStats();
  }

  @Get('dashboard/upcoming-shifts')
  @ApiOperation({ summary: 'Get upcoming shifts for volunteer dashboard' })
  @ApiResponse({ status: 200, description: 'Upcoming shifts' })
  async getUpcomingShifts(@Query('limit') limit?: number) {
    return this.volunteerService.getUpcomingShifts(limit || 10);
  }

  @Get('dashboard/volunteer/:volunteerId/summary')
  @ApiOperation({ summary: 'Get volunteer summary with hours and shifts' })
  @ApiResponse({ status: 200, description: 'Volunteer summary' })
  @ApiResponse({ status: 404, description: 'Volunteer not found' })
  async getVolunteerSummary(@Param('volunteerId') volunteerId: string) {
    return this.volunteerService.getVolunteerSummary(volunteerId);
  }
}